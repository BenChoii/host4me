"""
Host4Me Browser Agent — powered by browser-use

Uses browser-use + Gemini to navigate Airbnb/VRBO like a real user.
Vision-based navigation handles CAPTCHAs, dynamic UIs, and bot detection.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from browser_use import Agent, Browser, BrowserProfile

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DATA_DIR = os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data")


def get_llm():
    """Get Gemini model compatible with browser-use."""
    # browser-use works with OpenAI-compatible APIs via langchain_openai
    # Gemini exposes an OpenAI-compatible endpoint
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model="gemini-2.5-flash",
        api_key=GEMINI_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        temperature=0.1,
    )


def get_browser(pm_id: str) -> Browser:
    """Persistent browser with saved state per PM."""
    session_dir = Path(DATA_DIR) / "sessions" / pm_id
    session_dir.mkdir(parents=True, exist_ok=True)

    storage_path = session_dir / "storage.json"

    profile = BrowserProfile(
        headless=True,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 900},
        storage_state=str(storage_path) if storage_path.exists() else None,
    )

    return Browser(browser_profile=profile)


async def login_airbnb(pm_id: str, email: str, password: str) -> dict:
    """Login to Airbnb using vision-based browser agent."""
    llm = get_llm()
    browser = get_browser(pm_id)

    task = f"""
    Go to https://www.airbnb.com/login and log in with these credentials:
    - Email: {email}
    - Password: {password}

    Steps:
    1. Navigate to the login page
    2. Look for an email input field and enter the email
    3. Click continue/next
    4. Look for a password field and enter the password
    5. Click the login/submit button
    6. If you see a CAPTCHA or verification challenge, solve it
    7. If you see a 2FA/verification code request, STOP and report "2FA_REQUIRED"
    8. If login succeeds, navigate to https://www.airbnb.com/hosting/inbox
    9. Report what you see on the final page

    IMPORTANT: Report the exact URL you end up on and describe what you see.
    If login fails, describe exactly what went wrong.
    """

    try:
        agent = Agent(task=task, llm=llm, browser=browser, max_actions=20)
        result = await agent.run()

        # Save browser state
        try:
            await browser.close()
        except Exception:
            pass

        result_text = str(result)

        if "2FA_REQUIRED" in result_text or "verification code" in result_text.lower():
            return {"status": "2fa_required", "detail": result_text}
        elif "inbox" in result_text.lower() or "hosting" in result_text.lower():
            return {"status": "logged_in", "detail": result_text}
        else:
            return {"status": "unknown", "detail": result_text}

    except Exception as e:
        await browser.close()
        return {"status": "error", "message": str(e)}


async def check_inbox(pm_id: str, platform: str = "airbnb") -> dict:
    """Check inbox for unread messages using vision-based agent."""
    llm = get_llm()
    browser = get_browser(pm_id)

    task = f"""
    Navigate to https://www.airbnb.com/hosting/inbox

    If you see a login page, report "AUTH_REQUIRED" and stop.

    If you see the inbox:
    1. List ALL visible conversations in the left sidebar
    2. For each conversation, extract:
       - Guest name
       - Message preview text
       - Whether it appears unread (bold text, dot indicator, etc)
       - The date/time shown
    3. Report the results as a JSON array

    Format your response as ONLY a JSON array like this:
    [
      {{"guest_name": "Name", "preview": "message text...", "is_unread": true, "date": "Yesterday"}},
      ...
    ]

    Be precise. Only report what you actually see on the screen.
    """

    try:
        agent = Agent(task=task, llm=llm, browser=browser, max_actions=10)
        result = await agent.run()
        await browser.close()

        result_text = str(result)

        if "AUTH_REQUIRED" in result_text:
            return {"status": "auth_required"}

        # Try to extract JSON from the result
        try:
            # Find JSON array in the response
            start = result_text.index("[")
            end = result_text.rindex("]") + 1
            messages = json.loads(result_text[start:end])
            return {"status": "ok", "messages": messages, "count": len(messages)}
        except (ValueError, json.JSONDecodeError):
            return {"status": "ok", "raw": result_text, "messages": [], "count": 0}

    except Exception as e:
        await browser.close()
        return {"status": "error", "message": str(e)}


async def send_reply(pm_id: str, guest_name: str, message: str) -> dict:
    """Send a reply to a guest conversation using vision-based agent."""
    llm = get_llm()
    browser = get_browser(pm_id)

    task = f"""
    Navigate to https://www.airbnb.com/hosting/inbox

    If you see a login page, report "AUTH_REQUIRED" and stop.

    1. Find the conversation with "{guest_name}" in the left sidebar
    2. Click on it to open the conversation
    3. Find the message input field at the bottom
    4. Type this exact message: {message}
    5. Click the send button
    6. Confirm the message was sent

    Report whether the message was sent successfully.
    """

    try:
        agent = Agent(task=task, llm=llm, browser=browser, max_actions=15)
        result = await agent.run()
        await browser.close()

        result_text = str(result)
        if "AUTH_REQUIRED" in result_text:
            return {"status": "auth_required"}
        elif "sent" in result_text.lower() or "success" in result_text.lower():
            return {"status": "sent", "detail": result_text}
        else:
            return {"status": "unknown", "detail": result_text}

    except Exception as e:
        await browser.close()
        return {"status": "error", "message": str(e)}


# CLI interface for testing and for Node.js to call via subprocess
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python browser_agent.py <action> <pm_id> [args...]"}))
        sys.exit(1)

    action = sys.argv[1]
    pm_id = sys.argv[2]

    if action == "login" and len(sys.argv) >= 5:
        result = asyncio.run(login_airbnb(pm_id, sys.argv[3], sys.argv[4]))
    elif action == "inbox":
        platform = sys.argv[3] if len(sys.argv) > 3 else "airbnb"
        result = asyncio.run(check_inbox(pm_id, platform))
    elif action == "reply" and len(sys.argv) >= 5:
        result = asyncio.run(send_reply(pm_id, sys.argv[3], sys.argv[4]))
    else:
        result = {"error": f"Unknown action: {action}"}

    print(json.dumps(result))
