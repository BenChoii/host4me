"""
Onboarding tools — let Alfred drive onboarding conversationally with tools.

Instead of a rigid state machine, Alfred uses these tools to track progress and
save PM data as the conversation flows naturally.
"""

import json
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data"))
BACKEND_URL = os.environ.get("BACKEND_INTERNAL_URL", "http://localhost:3000")

# Steps and their completion requirements
ONBOARDING_STEPS = [
    "connect_platforms",   # At least one platform connected
    "add_properties",      # At least one property saved
    "house_rules",         # Rules for at least one property
    "communication_style", # Style preset selected
    "escalation_prefs",    # Escalation preferences confirmed
    "shadow_mode",         # Shadow mode activated
]


def _pm_dir(pm_id: str) -> Path:
    d = DATA_DIR / pm_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_json(path: Path, default=None):
    if path.exists():
        return json.loads(path.read_text())
    return default if default is not None else {}


def _save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def get_onboarding_status(pm_id: str) -> dict:
    """Check onboarding progress for a PM. Shows which steps are done and what's remaining.

    Args:
        pm_id: The property manager's ID.

    Returns:
        Dict with completed steps, remaining steps, and overall status.
    """
    pm_path = _pm_dir(pm_id)
    status = _load_json(pm_path / "onboarding.json", {"completed_steps": [], "is_live": False})

    props = _load_json(pm_path / "properties.json", [])
    rules = _load_json(pm_path / "house_rules.json")
    style = _load_json(pm_path / "style.json")

    # Auto-detect completed steps from data
    completed = set(status.get("completed_steps", []))
    if _load_json(pm_path / "platforms.json", []):
        completed.add("connect_platforms")
    if props:
        completed.add("add_properties")
    if rules:
        completed.add("house_rules")
    if style:
        completed.add("communication_style")

    remaining = [s for s in ONBOARDING_STEPS if s not in completed]

    return {
        "pm_id": pm_id,
        "completed": list(completed),
        "remaining": remaining,
        "is_live": status.get("is_live", False),
        "properties_count": len(props),
        "properties_with_rules": len(rules),
        "progress_pct": int(len(completed) / len(ONBOARDING_STEPS) * 100),
    }


def set_onboarding_step(pm_id: str, step: str, completed: bool = True) -> dict:
    """Mark an onboarding step as completed.

    Args:
        pm_id: The property manager's ID.
        step: The step name (e.g. "connect_platforms", "communication_style").
        completed: Whether the step is completed (default True).

    Returns:
        Updated onboarding status.
    """
    pm_path = _pm_dir(pm_id)
    status = _load_json(pm_path / "onboarding.json", {"completed_steps": [], "is_live": False})

    if completed and step not in status["completed_steps"]:
        status["completed_steps"].append(step)
    elif not completed and step in status["completed_steps"]:
        status["completed_steps"].remove(step)

    _save_json(pm_path / "onboarding.json", status)
    return get_onboarding_status(pm_id)


def request_platform_connect(pm_id: str, platform: str) -> dict:
    """Request the PM to connect a booking platform via the secure Mini App.

    This sends a message with a Mini App button for secure credential entry.
    Credentials are never passed through chat — only through the encrypted Mini App.

    Args:
        pm_id: The property manager's ID.
        platform: The platform to connect — "airbnb" or "vrbo".

    Returns:
        Instructions for Alfred to send the Mini App link.
    """
    mini_app_url = os.environ.get("MINI_APP_URL", "https://yourdomain.com/onboarding")
    url = f"{mini_app_url}/credential-form.html?platform={platform}&pm={pm_id}"

    # Save platform as pending
    pm_path = _pm_dir(pm_id)
    platforms = _load_json(pm_path / "platforms.json", [])
    if platform not in [p.get("name") for p in platforms]:
        platforms.append({"name": platform, "status": "pending"})
        _save_json(pm_path / "platforms.json", platforms)

    return {
        "status": "pending",
        "platform": platform,
        "mini_app_url": url,
        "instruction": (
            f"Send the PM a message with a Web App button linking to: {url}\n"
            f"Use telegram_send_with_buttons with a webApp button for '{platform.title()}'.\n"
            f"Remind them: credentials are encrypted and never visible to anyone."
        ),
    }


def save_escalation_preferences(pm_id: str, preferences: str) -> dict:
    """Save the PM's escalation preferences (what to escalate, what to handle autonomously).

    Args:
        pm_id: The property manager's ID.
        preferences: Natural language description of escalation preferences.

    Returns:
        Confirmation.
    """
    _save_json(_pm_dir(pm_id) / "escalation_prefs.json", {
        "custom_rules": preferences,
        "use_defaults": True,
    })
    return {"status": "saved", "preferences": preferences}


def activate_shadow_mode(pm_id: str) -> dict:
    """Activate shadow mode — all draft replies go to PM for approval before sending.

    Args:
        pm_id: The property manager's ID.

    Returns:
        Confirmation with shadow mode details.
    """
    pm_path = _pm_dir(pm_id)
    status = _load_json(pm_path / "onboarding.json", {"completed_steps": [], "is_live": False})
    status["shadow_mode"] = True
    status["shadow_started_at"] = __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc
    ).isoformat()
    if "shadow_mode" not in status["completed_steps"]:
        status["completed_steps"].append("shadow_mode")
    _save_json(pm_path / "onboarding.json", status)

    return {
        "status": "shadow_mode_active",
        "message": (
            "Shadow mode is active. When guest messages come in, I'll draft replies "
            "and send them to you for approval. I won't send anything to guests "
            "until you approve it."
        ),
    }


def go_live(pm_id: str) -> dict:
    """Switch from shadow mode to fully autonomous operation.

    Args:
        pm_id: The property manager's ID.

    Returns:
        Confirmation.
    """
    pm_path = _pm_dir(pm_id)
    status = _load_json(pm_path / "onboarding.json", {"completed_steps": [], "is_live": False})
    status["is_live"] = True
    status["shadow_mode"] = False
    status["live_at"] = __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc
    ).isoformat()
    _save_json(pm_path / "onboarding.json", status)

    return {
        "status": "live",
        "message": (
            "You're live! I'm now handling guest messages autonomously. "
            "You'll still get daily briefings, instant escalation alerts, "
            "and weekly performance reports."
        ),
    }
