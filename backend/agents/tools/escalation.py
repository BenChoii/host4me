"""
Escalation tools — urgency classification, thread pause/resume, history.

Uses an in-memory store. In production, replace with PostgreSQL.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data"))

# In-memory state (would be Redis/PostgreSQL in production)
_paused_threads: set[str] = set()
_escalation_log: list[dict] = []


def classify_urgency(message: str, guest_name: str = "", property_name: str = "") -> dict:
    """Classify the urgency of a guest message using keyword rules.

    Args:
        message: The guest message text.
        guest_name: The guest's name.
        property_name: The property name.

    Returns:
        Dict with 'level' (urgent/action/info/none) and 'reason'.
    """
    text = message.lower()

    # Urgent keywords
    urgent = ["fire", "gas", "smoke", "flood", "break-in", "injury", "hurt",
              "emergency", "lawyer", "legal", "sue", "attorney", "police"]
    for kw in urgent:
        if kw in text:
            return {"level": "urgent", "reason": f"Keyword detected: {kw}"}

    # Action required keywords
    action = ["refund", "compensation", "money back", "damage", "broken",
              "destroyed", "complaint", "unacceptable", "disgusting", "terrible"]
    for kw in action:
        if kw in text:
            return {"level": "action", "reason": f"Keyword detected: {kw}"}

    return {"level": "none", "reason": "No escalation triggers detected"}


def pause_auto_reply(thread_id: str) -> dict:
    """Pause auto-replies on a thread (escalation in progress).

    Args:
        thread_id: The message thread ID to pause.

    Returns:
        Confirmation.
    """
    _paused_threads.add(thread_id)
    return {"status": "paused", "thread_id": thread_id}


def resume_auto_reply(thread_id: str) -> dict:
    """Resume auto-replies on a previously paused thread.

    Args:
        thread_id: The message thread ID to resume.

    Returns:
        Confirmation.
    """
    _paused_threads.discard(thread_id)
    return {"status": "resumed", "thread_id": thread_id}


def get_escalation_history(pm_id: str = "", limit: int = 20) -> list:
    """Get recent escalation history.

    Args:
        pm_id: Optional filter by PM. If empty, returns all.
        limit: Maximum number of escalations to return.

    Returns:
        List of escalation records.
    """
    entries = _escalation_log
    if pm_id:
        entries = [e for e in entries if e.get("pm_id") == pm_id]
    return entries[-limit:]


def get_thread_context(thread_id: str) -> dict:
    """Get the full conversation context for a thread.

    Args:
        thread_id: The message thread ID.

    Returns:
        Thread context including messages and metadata.
    """
    # In production, this would pull from the message store
    return {
        "thread_id": thread_id,
        "paused": thread_id in _paused_threads,
        "messages": [],  # Would be populated from DB
    }


def resolve_escalation(thread_id: str, resolution: str = "") -> dict:
    """Mark an escalation as resolved and resume auto-replies.

    Args:
        thread_id: The thread ID of the escalation.
        resolution: How the escalation was resolved.

    Returns:
        Confirmation.
    """
    _paused_threads.discard(thread_id)
    _escalation_log.append({
        "thread_id": thread_id,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "resolution": resolution,
    })
    return {"status": "resolved", "thread_id": thread_id}
