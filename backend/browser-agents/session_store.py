"""
Session Store — PostgreSQL-backed browser session persistence.

Saves and restores Playwright browser contexts (cookies, localStorage, sessionStorage)
so sessions survive VPS reboots and browser restarts. Sessions are encrypted at rest
using AES-256-GCM.
"""

import json
import os
import base64
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://host4me:changeme@localhost:5432/host4me")
VAULT_KEY = os.environ.get("VAULT_ENCRYPTION_KEY", "")


def _get_fernet():
    """Derive a Fernet key from the vault encryption key."""
    if not VAULT_KEY:
        raise ValueError("VAULT_ENCRYPTION_KEY environment variable is required")
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"host4me-session-store",
        iterations=480000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(bytes.fromhex(VAULT_KEY)))
    return Fernet(key)


def _get_conn():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    """Create the sessions table if it doesn't exist."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS browser_sessions (
                    id SERIAL PRIMARY KEY,
                    pm_id VARCHAR(255) NOT NULL,
                    platform VARCHAR(50) NOT NULL,
                    session_data TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    expires_at TIMESTAMPTZ,
                    is_valid BOOLEAN DEFAULT TRUE,
                    UNIQUE(pm_id, platform)
                )
            """)
            conn.commit()
    finally:
        conn.close()


def save_session(pm_id: str, platform: str, storage_state: dict, ttl_days: int = 30):
    """
    Save a Playwright storage state (cookies + localStorage) to the database.
    The data is encrypted before storage.
    """
    fernet = _get_fernet()
    raw = json.dumps(storage_state)
    encrypted = fernet.encrypt(raw.encode()).decode()

    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO browser_sessions (pm_id, platform, session_data, updated_at, expires_at, is_valid)
                VALUES (%s, %s, %s, NOW(), NOW() + INTERVAL '%s days', TRUE)
                ON CONFLICT (pm_id, platform)
                DO UPDATE SET
                    session_data = EXCLUDED.session_data,
                    updated_at = NOW(),
                    expires_at = NOW() + INTERVAL '%s days',
                    is_valid = TRUE
            """, (pm_id, platform, encrypted, ttl_days, ttl_days))
            conn.commit()
    finally:
        conn.close()


def load_session(pm_id: str, platform: str) -> dict | None:
    """
    Load and decrypt a stored session. Returns None if no valid session exists.
    """
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT session_data, expires_at, is_valid
                FROM browser_sessions
                WHERE pm_id = %s AND platform = %s
            """, (pm_id, platform))
            row = cur.fetchone()

            if not row or not row["is_valid"]:
                return None

            if row["expires_at"] and row["expires_at"] < datetime.now(timezone.utc):
                invalidate_session(pm_id, platform)
                return None

            fernet = _get_fernet()
            decrypted = fernet.decrypt(row["session_data"].encode()).decode()
            return json.loads(decrypted)
    finally:
        conn.close()


def invalidate_session(pm_id: str, platform: str):
    """Mark a session as invalid (e.g., when login expires or 2FA is needed)."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE browser_sessions
                SET is_valid = FALSE, updated_at = NOW()
                WHERE pm_id = %s AND platform = %s
            """, (pm_id, platform))
            conn.commit()
    finally:
        conn.close()


def list_sessions(pm_id: str = None) -> list:
    """List all sessions, optionally filtered by PM."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if pm_id:
                cur.execute("""
                    SELECT pm_id, platform, is_valid, updated_at, expires_at
                    FROM browser_sessions WHERE pm_id = %s
                    ORDER BY updated_at DESC
                """, (pm_id,))
            else:
                cur.execute("""
                    SELECT pm_id, platform, is_valid, updated_at, expires_at
                    FROM browser_sessions
                    ORDER BY updated_at DESC
                """)
            return cur.fetchall()
    finally:
        conn.close()
