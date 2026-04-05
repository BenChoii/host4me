"""
ADK Agent Runner — FastAPI service that runs the Host4Me agent team.

Replaces Paperclip as the agent orchestration layer. Exposes endpoints for:
- Sending messages to Alfred (from Telegram bot or inbox polling)
- Running the agent team on a task
- Checking agent health/status

Uses Google ADK's Runner with InMemorySessionService for session management.
"""

import asyncio
import logging
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from . import alfred

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("adk-runner")

app = FastAPI(title="Host4Me ADK Agent Runner", version="1.0.0")

# Session service — stores conversation history per PM
session_service = InMemorySessionService()

# The runner executes Alfred (who delegates to sub-agents)
runner = Runner(
    agent=alfred,
    app_name="host4me",
    session_service=session_service,
)


class MessageRequest(BaseModel):
    pm_id: str
    message: str
    source: str = "telegram"  # telegram, inbox_poll, system


class TaskRequest(BaseModel):
    pm_id: str
    agent: str = "alfred"  # alfred, guest_comms, escalation, reporting
    task: str
    context: dict = {}


class AgentResponse(BaseModel):
    pm_id: str
    agent: str
    response: str
    actions: list[dict] = []


@app.post("/message", response_model=AgentResponse)
async def handle_message(req: MessageRequest):
    """Send a message to Alfred from the PM (via Telegram) or from a system event.

    Alfred will process it and either handle it directly or delegate to a sub-agent.
    """
    try:
        # Get or create session for this PM
        session = await session_service.get_session(
            app_name="host4me",
            user_id=req.pm_id,
            session_id=req.pm_id,
        )
        if not session:
            session = await session_service.create_session(
                app_name="host4me",
                user_id=req.pm_id,
                session_id=req.pm_id,
            )

        # Inject PM context into the message
        context_prefix = f"[PM: {req.pm_id}, Source: {req.source}]\n"
        full_message = context_prefix + req.message

        # Run the agent
        from google.adk.agents import types
        content = types.Content(
            role="user",
            parts=[types.Part(text=full_message)],
        )

        response_text = ""
        actions = []

        async for event in runner.run_async(
            user_id=req.pm_id,
            session_id=req.pm_id,
            new_message=content,
        ):
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text += part.text
            if hasattr(event, "actions"):
                actions.extend(event.actions)

        return AgentResponse(
            pm_id=req.pm_id,
            agent="alfred",
            response=response_text,
            actions=[],
        )

    except Exception as e:
        logger.error(f"Agent error for PM {req.pm_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/task", response_model=AgentResponse)
async def handle_task(req: TaskRequest):
    """Run a specific task on an agent (e.g., inbox poll triggers guest_comms).

    Used by the polling scheduler to route new guest messages to the right agent.
    """
    try:
        session = await session_service.get_session(
            app_name="host4me",
            user_id=req.pm_id,
            session_id=f"{req.pm_id}_{req.agent}",
        )
        if not session:
            session = await session_service.create_session(
                app_name="host4me",
                user_id=req.pm_id,
                session_id=f"{req.pm_id}_{req.agent}",
            )

        task_message = f"[Task for {req.agent}]\n{req.task}"
        if req.context:
            import json
            task_message += f"\n\nContext: {json.dumps(req.context)}"

        from google.adk.agents import types
        content = types.Content(
            role="user",
            parts=[types.Part(text=task_message)],
        )

        response_text = ""
        async for event in runner.run_async(
            user_id=req.pm_id,
            session_id=f"{req.pm_id}_{req.agent}",
            new_message=content,
        ):
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text += part.text

        return AgentResponse(
            pm_id=req.pm_id,
            agent=req.agent,
            response=response_text,
        )

    except Exception as e:
        logger.error(f"Task error for PM {req.pm_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """Health check for the agent runner."""
    return {
        "status": "ok",
        "agent": "alfred",
        "sub_agents": ["guest_comms", "escalation", "reporting"],
        "model": os.environ.get("OLLAMA_MODEL_PRIMARY", "gemma4:26b"),
    }


@app.get("/sessions/{pm_id}")
async def get_session_info(pm_id: str):
    """Get session info for a PM (for debugging)."""
    session = await session_service.get_session(
        app_name="host4me",
        user_id=pm_id,
        session_id=pm_id,
    )
    if not session:
        return {"pm_id": pm_id, "status": "no_session"}
    return {
        "pm_id": pm_id,
        "status": "active",
        "message_count": len(session.events) if hasattr(session, "events") else 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3200)
