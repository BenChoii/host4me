"""
Property management tools — CRUD for properties, house rules, and style guides.

Uses an in-memory store backed by JSON files. In production, replace with PostgreSQL.
"""

import json
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data"))


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


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------

def save_property(pm_id: str, name: str, location: str, platform: str = "airbnb",
                  bedrooms: int = 0, max_guests: int = 0,
                  check_in_time: str = "3:00 PM", check_out_time: str = "11:00 AM") -> dict:
    """Save a property for a PM.

    Args:
        pm_id: The property manager's ID.
        name: Property name (e.g. "Lakeside Cottage").
        location: Property location (e.g. "Kelowna, BC").
        platform: Booking platform — "airbnb" or "vrbo".
        bedrooms: Number of bedrooms.
        max_guests: Maximum number of guests.
        check_in_time: Check-in time.
        check_out_time: Check-out time.

    Returns:
        The saved property data.
    """
    props_path = _pm_dir(pm_id) / "properties.json"
    props = _load_json(props_path, [])

    prop = {
        "name": name,
        "location": location,
        "platform": platform,
        "bedrooms": bedrooms,
        "max_guests": max_guests,
        "check_in_time": check_in_time,
        "check_out_time": check_out_time,
    }

    # Update existing or append
    existing = next((i for i, p in enumerate(props) if p["name"] == name), None)
    if existing is not None:
        props[existing] = prop
    else:
        props.append(prop)

    _save_json(props_path, props)
    return {"status": "saved", "property": prop, "total_properties": len(props)}


def list_properties(pm_id: str) -> list:
    """List all properties for a PM.

    Args:
        pm_id: The property manager's ID.

    Returns:
        List of property objects.
    """
    return _load_json(_pm_dir(pm_id) / "properties.json", [])


def get_property_info(pm_id: str, property_name: str) -> dict:
    """Get details for a specific property.

    Args:
        pm_id: The property manager's ID.
        property_name: The name of the property.

    Returns:
        Property details including house rules.
    """
    props = list_properties(pm_id)
    prop = next((p for p in props if p["name"] == property_name), None)
    if not prop:
        return {"error": f"Property '{property_name}' not found"}

    rules = get_house_rules(pm_id, property_name)
    return {**prop, "house_rules": rules}


# ---------------------------------------------------------------------------
# House Rules
# ---------------------------------------------------------------------------

def save_house_rules(pm_id: str, property_name: str, rules: str) -> dict:
    """Save house rules for a property. The PM can type them naturally.

    Args:
        pm_id: The property manager's ID.
        property_name: The name of the property.
        rules: The house rules text (natural language, Alfred will parse it).

    Returns:
        Confirmation.
    """
    rules_path = _pm_dir(pm_id) / "house_rules.json"
    all_rules = _load_json(rules_path)
    all_rules[property_name] = rules
    _save_json(rules_path, all_rules)
    return {"status": "saved", "property": property_name}


def get_house_rules(pm_id: str, property_name: str) -> str:
    """Get house rules for a specific property.

    Args:
        pm_id: The property manager's ID.
        property_name: The name of the property.

    Returns:
        The house rules text, or empty string if none set.
    """
    rules = _load_json(_pm_dir(pm_id) / "house_rules.json")
    return rules.get(property_name, "")


# ---------------------------------------------------------------------------
# Communication Style
# ---------------------------------------------------------------------------

def set_communication_style(pm_id: str, preset: str = "friendly",
                            custom_instructions: str = "") -> dict:
    """Set the PM's communication style for guest messages.

    Args:
        pm_id: The property manager's ID.
        preset: Style preset — "professional", "friendly", "casual", or "luxury".
        custom_instructions: Additional style instructions (e.g. "use emoji sometimes").

    Returns:
        The saved style guide.
    """
    style = {
        "preset": preset,
        "custom_instructions": custom_instructions,
    }
    _save_json(_pm_dir(pm_id) / "style.json", style)
    return {"status": "saved", "style": style}


def get_style_guide(pm_id: str) -> dict:
    """Get the PM's communication style guide.

    Args:
        pm_id: The property manager's ID.

    Returns:
        Style guide with preset and custom instructions.
    """
    return _load_json(_pm_dir(pm_id) / "style.json", {"preset": "friendly", "custom_instructions": ""})
