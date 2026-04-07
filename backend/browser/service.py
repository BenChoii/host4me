"""
Host4Me Browser Agent — Autonomous vision-based web navigation

A persistent browser service with an intelligent agent loop:
  1. Take screenshot
  2. Ask Gemini "what do I see? what should I do next?"
  3. Execute the action (click coordinates, type, scroll, navigate)
  4. Take new screenshot
  5. Repeat until goal achieved or max steps reached

This replaces hardcoded CSS selectors with vision-based navigation
that adapts to any page layout.

Endpoints:
  POST /login      — Login to a platform
  POST /2fa        — Submit 2FA code
  POST /screenshot — Fresh screenshot + analysis
  POST /inbox      — Check inbox
  POST /navigate   — Go to any URL
  POST /action     — Perform any described action
  POST /goal       — NEW: Achieve a complex goal via agent loop
  GET  /debug/screenshot — Live PNG of current page
  GET  /health     — Health check
"""

import asyncio
import base64
import json
import os
import re
import sys
import traceback
from pathlib import Path

import httpx
from aiohttp import web
from playwright.async_api import async_playwright

# Try stealth
try:
    from playwright_stealth import stealth_async
except ImportError:
    async def stealth_async(page):
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            window.chrome = {runtime: {}};
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
        """)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DATA_DIR = os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data")
PORT = int(os.environ.get("BROWSER_SERVICE_PORT", "8100"))
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

MAX_AGENT_STEPS = 10  # Safety limit per goal

# Active browser sessions: pm_id -> {browser, context, page, session_dir, storage_path}
sessions = {}
playwright_instance = None


# ═══════════════════════════════════════════════════════════════════════════════
# Core: Gemini Vision
# ═══════════════════════════════════════════════════════════════════════════════

async def ask_gemini_vision(screenshot_bytes: bytes, prompt: str) -> str:
    """Send screenshot to Gemini for analysis."""
    b64 = base64.b64encode(screenshot_bytes).decode()
    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/png", "data": b64}},
        ]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4096},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(GEMINI_URL, json=payload)
        result = resp.json()
        return result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


# ═══════════════════════════════════════════════════════════════════════════════
# Core: Session Management
# ═══════════════════════════════════════════════════════════════════════════════

async def get_session(pm_id: str):
    """Get or create a persistent browser session for a PM."""
    global playwright_instance

    if pm_id in sessions and sessions[pm_id]["page"] and not sessions[pm_id]["page"].is_closed():
        return sessions[pm_id]

    if not playwright_instance:
        playwright_instance = await async_playwright().start()

    session_dir = Path(DATA_DIR) / "sessions" / pm_id
    session_dir.mkdir(parents=True, exist_ok=True)
    storage_path = session_dir / "storage.json"

    browser = await playwright_instance.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-infobars"],
    )
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 900},
        locale="en-US",
        timezone_id="America/Vancouver",
        storage_state=str(storage_path) if storage_path.exists() else None,
    )
    page = await context.new_page()
    await stealth_async(page)

    sessions[pm_id] = {
        "browser": browser, "context": context, "page": page,
        "session_dir": session_dir, "storage_path": storage_path,
    }
    return sessions[pm_id]


async def save_session(pm_id: str):
    """Save cookies/storage for a PM's session."""
    s = sessions.get(pm_id)
    if s and s["context"]:
        try:
            await s["context"].storage_state(path=str(s["storage_path"]))
        except Exception:
            pass


async def take_screenshot(pm_id: str) -> bytes:
    """Take a screenshot and save it."""
    s = await get_session(pm_id)
    ss = await s["page"].screenshot()
    ss_path = s["session_dir"] / "latest.png"
    with open(ss_path, "wb") as f:
        f.write(ss)
    return ss


async def screenshot_and_analyze(pm_id: str, prompt: str) -> dict:
    """Take screenshot, ask Gemini, return result."""
    s = await get_session(pm_id)
    ss = await take_screenshot(pm_id)
    analysis = await ask_gemini_vision(ss, prompt)
    return {"url": s["page"].url, "analysis": analysis}


# ═══════════════════════════════════════════════════════════════════════════════
# Core: Agent Action Executor
# ═══════════════════════════════════════════════════════════════════════════════

AGENT_ACTION_PROMPT = """You are a browser automation agent. Look at this screenshot and decide what action to take.

CURRENT GOAL: {goal}
STEP {step} of {max_steps}.
PREVIOUS ACTIONS: {history}

Available actions (respond with EXACTLY ONE):
  CLICK x y           — Click at pixel coordinates (x, y). Use this for buttons, links, inputs, etc.
  TYPE "text"          — Type text into the currently focused input field.
  FILL "selector" "text" — Fill a specific input by CSS selector.
  SCROLL direction amount — Scroll "up" or "down" by pixel amount (e.g. SCROLL down 500).
  GOTO url             — Navigate to a URL.
  WAIT seconds         — Wait for page to load (1-10 seconds).
  DONE result          — Goal achieved. Include a summary of what you found/did.
  FAIL reason          — Goal cannot be achieved. Explain why.

Rules:
- Look at the screenshot CAREFULLY. Identify elements by their VISUAL position.
- For CLICK, estimate the x,y pixel coordinates of the CENTER of the element you want to click.
- The viewport is 1280x900 pixels.
- If you see a form field, CLICK on it first, then TYPE the value.
- If the page needs to load, use WAIT.
- If you need to scroll to see more content, use SCROLL.
- Be precise with coordinates. Look at where elements are in the image.
- NEVER hallucinate. Only describe what you ACTUALLY see.
- Respond with the action on the FIRST line, then optionally explain your reasoning below."""


async def execute_agent_action(pm_id: str, action_text: str) -> str:
    """Parse and execute a single agent action. Returns result description."""
    s = await get_session(pm_id)
    page = s["page"]
    action = action_text.strip().split("\n")[0].strip()  # First line only

    try:
        if action.upper().startswith("CLICK"):
            match = re.match(r"CLICK\s+(\d+)\s+(\d+)", action, re.IGNORECASE)
            if match:
                x, y = int(match.group(1)), int(match.group(2))
                await page.mouse.click(x, y)
                await page.wait_for_timeout(2000)
                return f"Clicked at ({x}, {y})"
            return "CLICK requires x y coordinates"

        elif action.upper().startswith("TYPE"):
            match = re.match(r'TYPE\s+"([^"]*)"', action, re.IGNORECASE)
            if not match:
                match = re.match(r"TYPE\s+(.*)", action, re.IGNORECASE)
            if match:
                text = match.group(1).strip().strip('"')
                await page.keyboard.type(text, delay=50)
                await page.wait_for_timeout(1000)
                return f"Typed: {text}"
            return "TYPE requires text"

        elif action.upper().startswith("FILL"):
            match = re.match(r'FILL\s+"([^"]*)"\s+"([^"]*)"', action, re.IGNORECASE)
            if match:
                selector, text = match.group(1), match.group(2)
                el = await page.query_selector(selector)
                if el:
                    await el.fill(text)
                    await page.wait_for_timeout(1000)
                    return f"Filled {selector} with: {text}"
                return f"Selector not found: {selector}"
            return "FILL requires selector and text"

        elif action.upper().startswith("SCROLL"):
            match = re.match(r"SCROLL\s+(\w+)\s*(\d*)", action, re.IGNORECASE)
            if match:
                direction = match.group(1).lower()
                amount = int(match.group(2)) if match.group(2) else 500
                delta = -amount if direction == "up" else amount
                await page.mouse.wheel(0, delta)
                await page.wait_for_timeout(2000)
                return f"Scrolled {direction} by {amount}px"
            return "SCROLL requires direction"

        elif action.upper().startswith("GOTO"):
            url = action[4:].strip().strip('"').strip("'")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            return f"Navigated to {url}"

        elif action.upper().startswith("WAIT"):
            match = re.match(r"WAIT\s+(\d+)", action, re.IGNORECASE)
            seconds = int(match.group(1)) if match else 3
            seconds = min(seconds, 10)
            await page.wait_for_timeout(seconds * 1000)
            return f"Waited {seconds}s"

        elif action.upper().startswith("PRESS"):
            key = action[5:].strip().strip('"')
            await page.keyboard.press(key)
            await page.wait_for_timeout(1500)
            return f"Pressed {key}"

        elif action.upper().startswith("DONE"):
            return action  # Pass through

        elif action.upper().startswith("FAIL"):
            return action  # Pass through

        else:
            return f"Unknown action: {action}"

    except Exception as e:
        return f"Action error: {str(e)}"


async def run_agent_loop(pm_id: str, goal: str, max_steps: int = MAX_AGENT_STEPS) -> dict:
    """Run the autonomous agent loop until goal is achieved or max steps."""
    history = []
    steps_log = []

    for step in range(1, max_steps + 1):
        # Take screenshot
        ss = await take_screenshot(pm_id)
        s = await get_session(pm_id)

        # Ask Gemini what to do
        prompt = AGENT_ACTION_PROMPT.format(
            goal=goal,
            step=step,
            max_steps=max_steps,
            history="; ".join(history[-5:]) if history else "None yet",
        )
        action_text = await ask_gemini_vision(ss, prompt)
        first_line = action_text.strip().split("\n")[0].strip()

        print(f"[Agent] Step {step}/{max_steps} | Goal: {goal[:50]}... | Action: {first_line}")
        steps_log.append({"step": step, "action": first_line, "url": s["page"].url})

        # Check for completion
        if first_line.upper().startswith("DONE"):
            result_text = first_line[4:].strip()
            await save_session(pm_id)
            return {
                "status": "completed",
                "result": result_text,
                "steps": len(steps_log),
                "log": steps_log,
                "url": s["page"].url,
                "full_analysis": action_text,
            }

        if first_line.upper().startswith("FAIL"):
            reason = first_line[4:].strip()
            await save_session(pm_id)
            return {
                "status": "failed",
                "reason": reason,
                "steps": len(steps_log),
                "log": steps_log,
                "url": s["page"].url,
            }

        # Execute action
        result = await execute_agent_action(pm_id, action_text)
        history.append(f"Step {step}: {first_line} → {result}")

    # Max steps reached
    await save_session(pm_id)
    final = await screenshot_and_analyze(pm_id, f"Summarize the current state. The goal was: {goal}")
    return {
        "status": "max_steps",
        "result": final["analysis"],
        "steps": len(steps_log),
        "log": steps_log,
        "url": final["url"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# HTTP Handlers
# ═══════════════════════════════════════════════════════════════════════════════

async def handle_login(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")
    email = data.get("email", "")
    password = data.get("password", "")

    s = await get_session(pm_id)
    page = s["page"]

    try:
        # Navigate to login
        await page.goto("https://www.airbnb.com/login", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        # Use agent loop to fill email
        result = await run_agent_loop(pm_id,
            f"I need to log in. First, find the email/phone input field and enter this email: {email}. "
            f"Then click the Continue or Submit button. "
            f"If there's a 'Continue with email' or 'Log in with email' button, click that first. "
            f"When you've submitted the email and see a password field or next step, say DONE.",
            max_steps=5)

        if result["status"] == "failed":
            return web.json_response({"status": "error", "message": result.get("reason", "Could not enter email")})

        # Now handle password
        await page.wait_for_timeout(2000)
        result = await run_agent_loop(pm_id,
            f"I see a login page. If there's a password input field, click on it and type this password: {password}. "
            f"Then click the Log In / Continue / Submit button. "
            f"If you don't see a password field, describe what you see. "
            f"When you've submitted the password, say DONE.",
            max_steps=5)

        await page.wait_for_timeout(3000)

        # Analyze final state
        analysis = await screenshot_and_analyze(pm_id,
            "Is the user logged in? Is there a 2FA/verification code prompt? "
            "If 2FA, is the code sent via EMAIL or PHONE/SMS? What text does the page show? "
            "Is there a CAPTCHA? Respond starting with: LOGGED_IN, 2FA_EMAIL, 2FA_PHONE, 2FA_UNKNOWN, CAPTCHA, LOGIN_ERROR, or UNKNOWN.")

        await save_session(pm_id)

        upper = analysis["analysis"].upper()
        if "LOGGED_IN" in upper or "/hosting" in analysis["url"]:
            return web.json_response({"status": "logged_in", "analysis": analysis["analysis"]})
        elif "2FA" in upper:
            method = "email" if "EMAIL" in upper else "phone" if "PHONE" in upper else "unknown"
            return web.json_response({"status": "2fa_required", "method": method, "analysis": analysis["analysis"]})
        elif "CAPTCHA" in upper:
            return web.json_response({"status": "captcha", "analysis": analysis["analysis"]})
        else:
            return web.json_response({"status": "unknown", "analysis": analysis["analysis"]})

    except Exception as e:
        traceback.print_exc()
        return web.json_response({"status": "error", "message": str(e)})


async def handle_2fa(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")
    code = data.get("code", "")

    try:
        result = await run_agent_loop(pm_id,
            f"There should be a verification code input field on this page. "
            f"Click on the input field and type this code: {code}. "
            f"Then click the Submit/Continue/Verify button. "
            f"When done, say DONE with the result (logged in, error, etc).",
            max_steps=5)

        await save_session(pm_id)
        return web.json_response({
            "status": "submitted",
            "analysis": result.get("result", result.get("reason", "unknown")),
        })

    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_screenshot(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")
    prompt = data.get("prompt", "Describe what you see on this page in detail.")

    try:
        result = await screenshot_and_analyze(pm_id, prompt)
        return web.json_response(result)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_inbox(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")

    s = await get_session(pm_id)
    page = s["page"]

    try:
        # Navigate to inbox
        await page.goto("https://www.airbnb.com/hosting/inbox", wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(5000)

        if "/login" in page.url:
            return web.json_response({"status": "auth_required"})

        # Use agent loop to read the inbox
        result = await run_agent_loop(pm_id,
            "You are on the Airbnb hosting inbox page. Your goal is to read all conversations. "
            "Look at the page carefully: "
            "- If you see a list of conversations (guest names, message previews), say DONE and list them ALL as a JSON array: "
            '[{"guest_name": "...", "preview": "...", "is_unread": true/false, "date": "..."}]. '
            "- If the page is still loading, use WAIT. "
            "- If you need to scroll down to see more conversations, use SCROLL down. "
            "- If there's a popup or modal blocking the view, click to dismiss it. "
            "- If the page redirected to login, say FAIL auth_required. "
            "- If there are genuinely no conversations, say DONE NO_CONVERSATIONS. "
            "Only report what you ACTUALLY see. NEVER invent guest names or messages.",
            max_steps=6)

        await save_session(pm_id)

        if result["status"] == "failed":
            if "auth" in result.get("reason", "").lower():
                return web.json_response({"status": "auth_required"})
            return web.json_response({"status": "error", "message": result.get("reason", "unknown")})

        # Parse the result
        result_text = result.get("result", "") or result.get("full_analysis", "")

        if "NO_CONVERSATIONS" in result_text.upper():
            return web.json_response({"status": "ok", "messages": [], "count": 0, "raw": "No conversations found."})

        # Try to extract JSON array from the result
        try:
            start = result_text.index("[")
            end = result_text.rindex("]") + 1
            messages = json.loads(result_text[start:end])
            return web.json_response({"status": "ok", "messages": messages, "count": len(messages)})
        except (ValueError, json.JSONDecodeError):
            # Couldn't parse JSON — return raw analysis
            return web.json_response({"status": "ok", "raw": result_text, "messages": [], "count": 0})

    except Exception as e:
        traceback.print_exc()
        return web.json_response({"status": "error", "message": str(e)})


async def handle_navigate(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")
    url = data.get("url", "")

    s = await get_session(pm_id)
    try:
        await s["page"].goto(url, wait_until="domcontentloaded", timeout=30000)
        await s["page"].wait_for_timeout(3000)
        result = await screenshot_and_analyze(pm_id, "Describe what you see on this page.")
        await save_session(pm_id)
        return web.json_response(result)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_action(request):
    """Perform any described action using the agent loop."""
    data = await request.json()
    pm_id = data.get("pmId", "default")
    action_desc = data.get("action", "")

    try:
        result = await run_agent_loop(pm_id, action_desc, max_steps=8)
        await save_session(pm_id)
        return web.json_response({
            "status": result["status"],
            "analysis": result.get("result", result.get("reason", "")),
            "steps": result.get("steps", 0),
            "url": result.get("url", ""),
        })
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_goal(request):
    """Achieve a complex goal via the agent loop. Most flexible endpoint."""
    data = await request.json()
    pm_id = data.get("pmId", "default")
    goal = data.get("goal", "")
    max_steps = min(data.get("maxSteps", MAX_AGENT_STEPS), 15)
    start_url = data.get("startUrl", "")

    s = await get_session(pm_id)
    try:
        if start_url:
            await s["page"].goto(start_url, wait_until="domcontentloaded", timeout=30000)
            await s["page"].wait_for_timeout(3000)

        result = await run_agent_loop(pm_id, goal, max_steps=max_steps)
        await save_session(pm_id)
        return web.json_response(result)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_debug_screenshot(request):
    """Return the latest screenshot as a PNG image for debugging."""
    pm_id = request.query.get("pm", "default")
    s = sessions.get(pm_id)
    if not s:
        return web.json_response({"error": "no session"}, status=404)

    ss = await s["page"].screenshot(full_page=False)
    return web.Response(body=ss, content_type="image/png")


async def handle_health(request):
    return web.json_response({
        "status": "ok",
        "sessions": list(sessions.keys()),
        "session_count": len(sessions),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# App Setup
# ═══════════════════════════════════════════════════════════════════════════════

app = web.Application()
app.router.add_post("/login", handle_login)
app.router.add_post("/2fa", handle_2fa)
app.router.add_post("/screenshot", handle_screenshot)
app.router.add_post("/inbox", handle_inbox)
app.router.add_post("/navigate", handle_navigate)
app.router.add_post("/action", handle_action)
app.router.add_post("/goal", handle_goal)
app.router.add_get("/debug/screenshot", handle_debug_screenshot)
app.router.add_get("/health", handle_health)

if __name__ == "__main__":
    print(f"Browser agent starting on port {PORT}")
    print(f"Max steps per goal: {MAX_AGENT_STEPS}")
    web.run_app(app, port=PORT)
