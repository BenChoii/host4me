"""
Browser Agent Manager — Orchestrates Browser Use agents for each property manager.

Each PM gets isolated browser contexts for Airbnb and VRBO. The agents use Gemma 4
via Ollama for vision-based navigation (no brittle CSS selectors).
"""

import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from browser_use import Agent
from langchain_ollama import ChatOllama
from playwright.async_api import async_playwright

from session_store import init_db, save_session, load_session, invalidate_session

# Convex config for saving updated sessions back after agent runs
CONVEX_SITE_URL = os.environ.get("CONVEX_SITE_URL", "")
CONVEX_INTERNAL_SECRET = os.environ.get("CONVEX_INTERNAL_SECRET", "")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("browser-agents")

app = FastAPI(title="Host4Me Browser Agents", version="1.0.0")

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_PRIMARY = os.environ.get("OLLAMA_MODEL_PRIMARY", "gemma4:26b")
MODEL_FAST = os.environ.get("OLLAMA_MODEL_FAST", "gemma4:e4b")

# Active browser contexts per PM
_contexts: dict[str, dict] = {}


def _get_llm(model: str = None):
    """Create an Ollama-backed LLM instance for Browser Use."""
    return ChatOllama(
        model=model or MODEL_FAST,
        base_url=OLLAMA_BASE_URL,
        temperature=0.3,
    )


class CheckInboxRequest(BaseModel):
    pm_id: str
    platform: str  # "airbnb" or "vrbo"


class SendReplyRequest(BaseModel):
    pm_id: str
    platform: str
    thread_id: str
    message: str


class AuthCodeRequest(BaseModel):
    pm_id: str
    platform: str
    code: str


class InboxResult(BaseModel):
    pm_id: str
    platform: str
    messages: list[dict]
    status: str
    checked_at: str


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("Browser Agent Manager started")


@app.post("/check-inbox", response_model=InboxResult)
async def check_inbox(req: CheckInboxRequest):
    """
    Use an AI browser agent to check the PM's inbox on Airbnb or VRBO.
    The agent navigates visually — no hardcoded selectors.
    """
    llm = _get_llm(MODEL_FAST)

    # Restore session if available
    storage_state = load_session(req.pm_id, req.platform)

    platform_url = {
        "airbnb": "https://www.airbnb.com/hosting/inbox",
        "vrbo": "https://www.vrbo.com/host/inbox",
    }.get(req.platform)

    if not platform_url:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {req.platform}")

    task = f"""
    Navigate to {platform_url} and check for new unread messages.

    For each unread message, extract:
    - Guest name
    - Property/listing name
    - Message preview (first 200 characters)
    - Thread ID or URL
    - Timestamp
    - Whether it needs a reply

    If you encounter a login page or 2FA prompt, stop and report
    "AUTH_REQUIRED" with details about what's needed.

    Return the results as a JSON array of message objects.
    """

    try:
        agent = Agent(
            task=task,
            llm=llm,
            browser_context_args={
                "storage_state": storage_state,
            } if storage_state else {},
        )

        result = await agent.run()

        # Save updated session state
        if agent.browser_context:
            new_state = await agent.browser_context.storage_state()
            save_session(req.pm_id, req.platform, new_state)

        # Check if auth is needed
        result_text = str(result)
        if "AUTH_REQUIRED" in result_text:
            invalidate_session(req.pm_id, req.platform)
            return InboxResult(
                pm_id=req.pm_id,
                platform=req.platform,
                messages=[],
                status="auth_required",
                checked_at=datetime.utcnow().isoformat(),
            )

        return InboxResult(
            pm_id=req.pm_id,
            platform=req.platform,
            messages=result if isinstance(result, list) else [],
            status="ok",
            checked_at=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error(f"Inbox check failed for {req.pm_id}/{req.platform}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/send-reply")
async def send_reply(req: SendReplyRequest):
    """
    Use an AI browser agent to navigate to a specific thread and send a reply.
    """
    llm = _get_llm(MODEL_FAST)
    storage_state = load_session(req.pm_id, req.platform)

    if not storage_state:
        raise HTTPException(status_code=401, detail="No valid session. Re-authentication needed.")

    task = f"""
    Navigate to the message thread at {req.thread_id} on {req.platform}.

    Type the following reply message and send it:

    "{req.message}"

    After sending, confirm the message was sent successfully.
    If you encounter any issues (login required, thread not found), report the error.
    """

    try:
        agent = Agent(
            task=task,
            llm=llm,
            browser_context_args={"storage_state": storage_state},
        )

        result = await agent.run()

        # Save updated session
        if agent.browser_context:
            new_state = await agent.browser_context.storage_state()
            save_session(req.pm_id, req.platform, new_state)

        return {"status": "sent", "result": str(result)}

    except Exception as e:
        logger.error(f"Reply failed for {req.pm_id}/{req.platform}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/submit-auth-code")
async def submit_auth_code(req: AuthCodeRequest):
    """
    When a platform requests 2FA, the PM sends the code via Telegram.
    This endpoint uses the browser agent to enter the code.
    """
    llm = _get_llm(MODEL_PRIMARY)

    platform_url = {
        "airbnb": "https://www.airbnb.com/login",
        "vrbo": "https://www.vrbo.com/login",
    }.get(req.platform)

    task = f"""
    The platform is requesting a verification code.
    Find the verification code input field and enter: {req.code}
    Then submit/confirm the code.
    If successful, confirm login is complete.
    If the code is rejected, report the error.
    """

    try:
        agent = Agent(task=task, llm=llm)
        result = await agent.run()

        # Save the new session after successful auth
        if agent.browser_context:
            new_state = await agent.browser_context.storage_state()
            save_session(req.pm_id, req.platform, new_state)

        return {"status": "ok", "result": str(result)}

    except Exception as e:
        logger.error(f"Auth code submission failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class PlatformSyncRequest(BaseModel):
    tenant_id: str
    platform: str          # "vrbo" | "airbnb" | "booking"
    storage_state: Optional[str] = None   # JSON string from Convex browserSessions
    base_url: Optional[str] = None        # finalUrl from last login, e.g. https://owner.vrbo.com/en-ca/dashboard


def _build_vrbo_sync_task(base_url: str) -> str:
    """Build the VRBO agent task. Derives locale prefix from base_url."""
    # Extract locale prefix: https://owner.vrbo.com/en-ca/dashboard → /en-ca
    locale = ""
    if base_url:
        import re
        m = re.search(r"owner\.vrbo\.com(/[a-z]{2}-[a-z]{2})", base_url)
        if m:
            locale = m.group(1)

    reservations_url = f"https://owner.vrbo.com{locale}/reservations" if locale else "https://owner.vrbo.com/reservations"
    properties_url = f"https://owner.vrbo.com{locale}/properties" if locale else "https://owner.vrbo.com/properties"

    return f"""
You are Alfred, an AI property management assistant. Your job is to browse VRBO and extract data from three pages.

If at any point you see a login or authentication page, stop and return exactly: {{"status": "AUTH_REQUIRED"}}

## Page 1 — Reservations
Navigate to: {reservations_url}
Wait for the page to load. Extract ALL reservations visible on the page:
- Guest name
- Property/listing name
- Check-in date (YYYY-MM-DD format)
- Check-out date (YYYY-MM-DD format)
- Booking status (confirmed/pending/cancelled)
- Total payout or nightly rate if visible
- Reservation/confirmation code if visible

## Page 2 — Inbox
Navigate to: https://www.vrbo.com/host/inbox
Wait for conversations to load. Extract all conversations:
- Guest name
- Property name
- Most recent message preview (first 200 characters)
- Thread URL
- Whether it appears unread (bold/highlighted indicator)
- Approximate timestamp

## Page 3 — Properties
Navigate to: {properties_url}
Extract all property listings:
- Property name/title
- Location/address
- Listing status (active/inactive)
- Number of bedrooms if shown
- Nightly rate if visible
- Listing ID or URL

## Output Format
Return a single JSON object:
{{
  "status": "ok",
  "reservations": [ {{ "guestName": "...", "propertyName": "...", "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD", "status": "confirmed", "payout": "...", "reservationId": "..." }} ],
  "inbox": [ {{ "guestName": "...", "propertyName": "...", "messagePreview": "...", "threadUrl": "...", "isUnread": true, "timestamp": "..." }} ],
  "properties": [ {{ "name": "...", "location": "...", "status": "active", "bedrooms": 2, "nightlyRate": "...", "listingId": "..." }} ]
}}
"""


def _build_airbnb_sync_task() -> str:
    return """
You are Alfred, an AI property management assistant. Browse Airbnb and extract data from three pages.

If you see a login page at any point, return: {"status": "AUTH_REQUIRED"}

## Page 1 — Reservations
Navigate to: https://www.airbnb.com/hosting/reservations/all
Extract all reservations: guest name, listing, check-in, check-out, status, payout, confirmation code.

## Page 2 — Inbox
Navigate to: https://www.airbnb.com/hosting/inbox
Extract conversations: guest name, listing, message preview, thread URL, unread status, timestamp.

## Page 3 — Listings
Navigate to: https://www.airbnb.com/hosting/listings
Extract listings: name, location, status, bedrooms, nightly rate, listing ID.

Return JSON:
{
  "status": "ok",
  "reservations": [...],
  "inbox": [...],
  "properties": [...]
}
"""


@app.post("/platform-sync")
async def platform_sync(req: PlatformSyncRequest):
    """
    Full AI agent sync: navigate the platform and extract reservations, inbox,
    and properties. Accepts storage state from Convex, returns structured data.

    This is the "Alfred browses like a human assistant" endpoint.
    """
    logger.info(f"[platform-sync] Starting {req.platform} sync for tenant {req.tenant_id}")

    # Load storage state
    storage_state = None
    if req.storage_state:
        try:
            storage_state = json.loads(req.storage_state)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid storage_state JSON")

    # Fall back to local PostgreSQL session store
    if not storage_state:
        storage_state = load_session(req.tenant_id, req.platform)

    if not storage_state:
        raise HTTPException(
            status_code=401,
            detail=f"No session for {req.platform}. Connect via the dashboard first."
        )

    # Build platform-specific task
    if req.platform == "vrbo":
        task = _build_vrbo_sync_task(req.base_url or "")
    elif req.platform == "airbnb":
        task = _build_airbnb_sync_task()
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {req.platform}")

    llm = _get_llm(MODEL_PRIMARY)  # Use the big model for comprehensive data extraction

    try:
        agent = Agent(
            task=task,
            llm=llm,
            browser_context_args={"storage_state": storage_state},
        )

        raw_result = await agent.run()
        result_text = str(raw_result)

        # Save updated session state back to local store
        updated_storage_state = None
        if agent.browser_context:
            try:
                updated_storage_state = await agent.browser_context.storage_state()
                save_session(req.tenant_id, req.platform, updated_storage_state)
                logger.info(f"[platform-sync] Session updated for {req.tenant_id}/{req.platform}")
            except Exception as se:
                logger.warning(f"[platform-sync] Failed to save session: {se}")

        # Check for auth failure
        if "AUTH_REQUIRED" in result_text:
            invalidate_session(req.tenant_id, req.platform)
            return {
                "status": "auth_required",
                "platform": req.platform,
                "tenant_id": req.tenant_id,
            }

        # Parse the JSON result from the agent
        data = {}
        import re
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
            except json.JSONDecodeError:
                logger.warning(f"[platform-sync] Could not parse agent JSON output: {result_text[:300]}")
                data = {"raw": result_text[:2000]}

        return {
            "status": "ok",
            "platform": req.platform,
            "tenant_id": req.tenant_id,
            "reservations": data.get("reservations", []),
            "inbox": data.get("inbox", []),
            "properties": data.get("properties", []),
            "updated_storage_state": json.dumps(updated_storage_state) if updated_storage_state else None,
            "synced_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"[platform-sync] Failed for {req.tenant_id}/{req.platform}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_FAST}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
