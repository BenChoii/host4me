"""
Browser Agent Manager — Orchestrates Browser Use agents for each property manager.

Each PM gets isolated browser contexts for Airbnb and VRBO. The agents use Gemma 4
via Ollama for vision-based navigation (no brittle CSS selectors).
"""

import os
import asyncio
import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from browser_use import Agent
from langchain_ollama import ChatOllama
from playwright.async_api import async_playwright

from session_store import init_db, save_session, load_session, invalidate_session

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


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_FAST}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
