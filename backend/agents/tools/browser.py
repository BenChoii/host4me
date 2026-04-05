"""
Browser automation tools — interact with Airbnb/VRBO via Browser Use agents.
"""

import os
import httpx

BROWSER_AGENT_URL = os.environ.get("BROWSER_AGENT_URL", "http://localhost:8100")
TIMEOUT = 120  # Browser tasks can be slow


def check_inbox(pm_id: str, platform: str) -> dict:
    """Check a PM's inbox on Airbnb or VRBO for new guest messages.

    Args:
        pm_id: The property manager's ID.
        platform: The platform to check — "airbnb" or "vrbo".

    Returns:
        Dict with 'messages' (list of new messages) and 'status' ("ok" or "auth_required").
    """
    resp = httpx.post(
        f"{BROWSER_AGENT_URL}/check-inbox",
        json={"pm_id": pm_id, "platform": platform},
        timeout=TIMEOUT,
    )
    return resp.json()


def send_reply(pm_id: str, platform: str, thread_id: str, message: str) -> dict:
    """Send a reply to a guest message thread via browser automation.

    Args:
        pm_id: The property manager's ID.
        platform: The platform — "airbnb" or "vrbo".
        thread_id: The thread URL or ID to reply to.
        message: The reply message text.

    Returns:
        Status of the send operation.
    """
    resp = httpx.post(
        f"{BROWSER_AGENT_URL}/send-reply",
        json={
            "pm_id": pm_id,
            "platform": platform,
            "thread_id": thread_id,
            "message": message,
        },
        timeout=TIMEOUT,
    )
    return resp.json()


def check_bookings(pm_id: str, platform: str) -> dict:
    """Check current and upcoming bookings on a platform.

    Args:
        pm_id: The property manager's ID.
        platform: The platform — "airbnb" or "vrbo".

    Returns:
        Dict with booking information.
    """
    resp = httpx.post(
        f"{BROWSER_AGENT_URL}/check-bookings",
        json={"pm_id": pm_id, "platform": platform},
        timeout=TIMEOUT,
    )
    return resp.json()
