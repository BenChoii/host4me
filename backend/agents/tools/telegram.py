"""
Telegram tools — send messages and interactive keyboards to the PM.
"""

import json
import os
import httpx

BACKEND_URL = os.environ.get("BACKEND_INTERNAL_URL", "http://localhost:3000")


def telegram_send(pm_id: str, message: str) -> dict:
    """Send a Telegram message to the property manager.

    Args:
        pm_id: The property manager's ID.
        message: The message text (supports Telegram Markdown).

    Returns:
        Status of the send operation.
    """
    resp = httpx.post(
        f"{BACKEND_URL}/internal/telegram/send",
        json={"pmId": pm_id, "message": message},
        timeout=10,
    )
    return resp.json() if resp.status_code == 200 else {"error": resp.text}


def telegram_send_with_buttons(pm_id: str, message: str, buttons: list[dict]) -> dict:
    """Send a Telegram message with inline keyboard buttons.

    Args:
        pm_id: The property manager's ID.
        message: The message text (supports Telegram Markdown).
        buttons: List of button rows. Each row is a dict with 'text' and 'callback_data'.
                 Example: [{"text": "Professional", "callback_data": "style_professional"}]

    Returns:
        Status of the send operation.
    """
    resp = httpx.post(
        f"{BACKEND_URL}/internal/telegram/send",
        json={
            "pmId": pm_id,
            "message": message,
            "buttons": buttons,
        },
        timeout=10,
    )
    return resp.json() if resp.status_code == 200 else {"error": resp.text}
