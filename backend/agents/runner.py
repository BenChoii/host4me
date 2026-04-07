"""
ADK Agent Runner — FastAPI service that runs the Host4Me agent team.

Multi-tenant SaaS architecture:
- Each tenant gets their own session (keyed by tenant_id)
- All LLM calls go through OpenRouter (Gemma 4 26B MoE)
- Convex manages data; this service handles agent execution
- Secured by WORKER_API_SECRET bearer token

Endpoints:
- POST /agent/chat     — Send a message to Alfred (from Telegram or web)
- POST /agent/briefing — Generate a daily/weekly briefing
- POST /browser/login  — Login to Airbnb via browser agent
- POST /browser/inbox  — Check Airbnb inbox
- POST /browser/submit-2fa — Submit 2FA code
- POST /gmail/sync     — Sync Gmail and extract property details
- GET  /health         — Health check
"""

import asyncio
import json
import logging
import os

from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from . import alfred

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

app = FastAPI(title="Host4Me Worker", version="2.0.0")

WORKER_API_SECRET = os.environ.get("WORKER_API_SECRET", "")

# Session service — stores conversation history per tenant
session_service = InMemorySessionService()

# Alfred runner
runner = Runner(
    agent=alfred,
    app_name="host4me",
    session_service=session_service,
)


# --- Auth ---

async def verify_secret(authorization: str = Header(default="")):
    """Verify the shared API secret from Convex."""
    if not WORKER_API_SECRET:
        return  # No secret configured, allow all (dev mode)
    expected = f"Bearer {WORKER_API_SECRET}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# --- Models ---

class ChatRequest(BaseModel):
    tenant_id: str
    message: str
    source: str = "telegram"

class ChatResponse(BaseModel):
    tenant_id: str
    reply: str
    metadata: dict = {}

class BriefingRequest(BaseModel):
    tenant_id: str
    type: str = "daily"  # daily, weekly, monthly

class BrowserLoginRequest(BaseModel):
    tenant_id: str
    platform: str = "airbnb"
    email: str
    password: str

class BrowserInboxRequest(BaseModel):
    tenant_id: str
    platform: str = "airbnb"

class Submit2FARequest(BaseModel):
    tenant_id: str
    platform: str
    code: str

class GmailSyncRequest(BaseModel):
    tenant_id: str


# --- Agent Chat ---

@app.post("/agent/chat", response_model=ChatResponse, dependencies=[Depends(verify_secret)])
async def chat_with_alfred(req: ChatRequest):
    """Send a message to Alfred and get a response."""
    try:
        session = await session_service.get_session(
            app_name="host4me",
            user_id=req.tenant_id,
            session_id=req.tenant_id,
        )
        if not session:
            session = await session_service.create_session(
                app_name="host4me",
                user_id=req.tenant_id,
                session_id=req.tenant_id,
            )

        context_prefix = f"[Tenant: {req.tenant_id}, Source: {req.source}]\n"
        full_message = context_prefix + req.message

        from google.adk.agents import types
        content = types.Content(
            role="user",
            parts=[types.Part(text=full_message)],
        )

        response_text = ""
        async for event in runner.run_async(
            user_id=req.tenant_id,
            session_id=req.tenant_id,
            new_message=content,
        ):
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text += part.text

        return ChatResponse(
            tenant_id=req.tenant_id,
            reply=response_text,
        )

    except Exception as e:
        logger.error(f"Chat error for tenant {req.tenant_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/briefing", response_model=ChatResponse, dependencies=[Depends(verify_secret)])
async def generate_briefing(req: BriefingRequest):
    """Generate a daily/weekly/monthly briefing via Alfred."""
    prompts = {
        "daily": "Generate today's daily briefing. Summarize messages, bookings, escalations, and any insights.",
        "weekly": "Generate the weekly report. Include trends, performance metrics, and strategic recommendations.",
        "monthly": "Generate the monthly analytics report. Revenue trends, occupancy rates, and optimization suggestions.",
    }
    message = prompts.get(req.type, prompts["daily"])

    return await chat_with_alfred(ChatRequest(
        tenant_id=req.tenant_id,
        message=f"[SYSTEM] {message}",
        source="cron",
    ))


# --- Browser Agent ---

@app.post("/browser/login", dependencies=[Depends(verify_secret)])
async def browser_login(req: BrowserLoginRequest):
    """Login to a platform via the browser agent."""
    from .browser_bridge import run_browser_agent
    result = await run_browser_agent("login", req.tenant_id, req.email, req.password)
    return result


@app.post("/browser/inbox", dependencies=[Depends(verify_secret)])
async def browser_inbox(req: BrowserInboxRequest):
    """Check platform inbox via browser agent."""
    from .browser_bridge import run_browser_agent
    result = await run_browser_agent("inbox", req.tenant_id, req.platform)
    return result


@app.post("/browser/submit-2fa", dependencies=[Depends(verify_secret)])
async def browser_submit_2fa(req: Submit2FARequest):
    """Submit 2FA code to browser agent."""
    from .browser_bridge import run_browser_agent
    result = await run_browser_agent("submit_2fa", req.tenant_id, req.platform, req.code)
    return result


# --- Gmail ---

@app.post("/gmail/sync", dependencies=[Depends(verify_secret)])
async def gmail_sync(req: GmailSyncRequest):
    """Sync Gmail and extract property details."""
    # TODO: Implement Gmail sync with OAuth tokens from Convex
    return {
        "tenant_id": req.tenant_id,
        "emails_processed": 0,
        "memories": [],
        "status": "not_implemented",
    }


@app.post("/gmail/exchange-token", dependencies=[Depends(verify_secret)])
async def gmail_exchange_token(code: str):
    """Exchange Gmail OAuth code for access/refresh tokens."""
    # TODO: Implement OAuth token exchange
    return {"error": "not_implemented"}


# --- Health ---

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agent": "alfred",
        "sub_agents": ["guest_comms", "escalation", "reporting", "market_research", "profile_optimizer"],
        "model": os.environ.get("AGENT_MODEL_PRIMARY", "google/gemma-4-26b-a4b-it"),
        "provider": "openrouter",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3200)
