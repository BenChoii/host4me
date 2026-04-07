"""
Host4Me Browser Service — Persistent browser with HTTP API

Runs as a long-lived process. Keeps browser sessions open per PM.
Express server communicates via HTTP. Gemini vision analyzes pages.

Endpoints:
  POST /login     — Login to a platform
  POST /2fa       — Submit 2FA code
  POST /screenshot — Take fresh screenshot + analysis
  POST /inbox     — Check inbox
  POST /navigate  — Go to any URL
  POST /action    — Perform a described action (Gemini decides how)
  POST /reply     — Reply to a guest
  GET  /health    — Health check
"""

import asyncio
import base64
import json
import os
import sys
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

# Active browser sessions: pm_id -> {browser, context, page}
sessions = {}
playwright_instance = None


async def ask_gemini_vision(screenshot_bytes: bytes, prompt: str) -> str:
    """Send screenshot to Gemini for analysis."""
    b64 = base64.b64encode(screenshot_bytes).decode()
    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/png", "data": b64}},
        ]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(GEMINI_URL, json=payload)
        result = resp.json()
        return result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


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

    sessions[pm_id] = {"browser": browser, "context": context, "page": page, "session_dir": session_dir, "storage_path": storage_path}
    return sessions[pm_id]


async def save_session(pm_id: str):
    """Save cookies/storage for a PM's session."""
    s = sessions.get(pm_id)
    if s and s["context"]:
        try:
            await s["context"].storage_state(path=str(s["storage_path"]))
        except Exception:
            pass


async def take_screenshot_and_analyze(pm_id: str, prompt: str) -> dict:
    """Take a fresh screenshot and ask Gemini about it."""
    s = await get_session(pm_id)
    ss = await s["page"].screenshot()

    # Save screenshot
    ss_path = s["session_dir"] / "latest.png"
    with open(ss_path, "wb") as f:
        f.write(ss)

    analysis = await ask_gemini_vision(ss, prompt)
    return {"url": s["page"].url, "analysis": analysis, "screenshot": str(ss_path)}


# ─── HTTP Handlers ───

async def handle_login(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")
    email = data.get("email", "")
    password = data.get("password", "")
    platform = data.get("platform", "airbnb")

    s = await get_session(pm_id)
    page = s["page"]

    try:
        await page.goto("https://www.airbnb.com/login", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        # Ask Gemini what to do
        ss = await page.screenshot()
        plan = await ask_gemini_vision(ss,
            "I need to log in with email and password. What should I click first? "
            "If there's an email input visible, say EMAIL_INPUT_VISIBLE. "
            "Otherwise tell me the exact button text to click.")

        # Find and fill email
        email_filled = False
        if "EMAIL_INPUT_VISIBLE" in plan.upper():
            for sel in ['input[type="email"]', 'input[name="email"]', 'input[type="text"]', 'input[inputmode="email"]']:
                el = await page.query_selector(sel)
                if el:
                    await el.fill(email)
                    email_filled = True
                    break
        else:
            # Click the button Gemini identified
            try:
                await page.get_by_text("email", exact=False).first.click(timeout=5000)
                await page.wait_for_timeout(2000)
            except Exception:
                pass
            for sel in ['input[type="email"]', 'input[name="email"]', 'input[type="text"]', 'input[inputmode="email"]']:
                el = await page.query_selector(sel)
                if el:
                    await el.fill(email)
                    email_filled = True
                    break

        if not email_filled:
            # Try any visible input
            inputs = await page.query_selector_all("input:visible")
            for inp in inputs:
                t = await inp.get_attribute("type")
                if t in ["email", "text", None, ""]:
                    await inp.fill(email)
                    email_filled = True
                    break

        if not email_filled:
            return web.json_response({"status": "error", "message": "Could not find email input"})

        # Submit email
        submit = await page.query_selector('button[type="submit"]')
        if submit:
            await submit.click()
        await page.wait_for_timeout(3000)

        # Fill password
        pw = await page.query_selector('input[type="password"]')
        if pw:
            await pw.fill(password)
            submit = await page.query_selector('button[type="submit"]')
            if submit:
                await submit.click()
            await page.wait_for_timeout(5000)

        # Analyze result
        result = await take_screenshot_and_analyze(pm_id,
            "Is the user logged in? Is there a 2FA/verification code prompt? "
            "If 2FA, is the code sent via EMAIL or PHONE/SMS? What text does the page show? "
            "Is there a CAPTCHA? Respond starting with: LOGGED_IN, 2FA_EMAIL, 2FA_PHONE, 2FA_UNKNOWN, CAPTCHA, LOGIN_ERROR, or UNKNOWN.")

        await save_session(pm_id)

        analysis = result["analysis"].upper()
        if "LOGGED_IN" in analysis or "/hosting" in result["url"]:
            return web.json_response({"status": "logged_in", "analysis": result["analysis"]})
        elif "2FA" in analysis:
            method = "email" if "EMAIL" in analysis else "phone" if "PHONE" in analysis else "unknown"
            return web.json_response({"status": "2fa_required", "method": method, "analysis": result["analysis"]})
        elif "CAPTCHA" in analysis:
            return web.json_response({"status": "captcha", "analysis": result["analysis"]})
        else:
            return web.json_response({"status": "unknown", "analysis": result["analysis"]})

    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_2fa(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")
    code = data.get("code", "")

    s = await get_session(pm_id)
    page = s["page"]

    try:
        # Find code input
        for sel in ['input[name="code"]', 'input[inputmode="numeric"]', 'input[type="tel"]', 'input[data-testid="verification-code-input"]', 'input[type="text"]']:
            el = await page.query_selector(sel)
            if el:
                await el.fill(code)
                break

        submit = await page.query_selector('button[type="submit"]')
        if submit:
            await submit.click()
        await page.wait_for_timeout(5000)

        result = await take_screenshot_and_analyze(pm_id,
            "Did the 2FA succeed? Is the user now logged in? Or is there an error?")

        await save_session(pm_id)
        return web.json_response({"status": "submitted", "analysis": result["analysis"]})

    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_screenshot(request):
    """Take a fresh screenshot and analyze the current page."""
    data = await request.json()
    pm_id = data.get("pmId", "default")
    prompt = data.get("prompt", "Describe what you see on this page in detail. What is the current state?")

    try:
        result = await take_screenshot_and_analyze(pm_id, prompt)
        return web.json_response(result)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_inbox(request):
    data = await request.json()
    pm_id = data.get("pmId", "default")

    s = await get_session(pm_id)
    page = s["page"]

    try:
        await page.goto("https://www.airbnb.com/hosting/inbox", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)

        if "/login" in page.url:
            return web.json_response({"status": "auth_required"})

        result = await take_screenshot_and_analyze(pm_id,
            "This is an Airbnb hosting inbox. List ALL conversations in the sidebar. "
            "For each: guest name, message preview, unread status, date. "
            "Format as JSON array: [{\"guest_name\": \"\", \"preview\": \"\", \"is_unread\": true, \"date\": \"\"}]. "
            "Only report what you actually see.")

        await save_session(pm_id)

        # Parse JSON from response
        try:
            text = result["analysis"]
            start = text.index("[")
            end = text.rindex("]") + 1
            messages = json.loads(text[start:end])
            return web.json_response({"status": "ok", "messages": messages, "count": len(messages)})
        except (ValueError, json.JSONDecodeError):
            return web.json_response({"status": "ok", "raw": result["analysis"], "messages": [], "count": 0})

    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_navigate(request):
    """Navigate to any URL and report what's there."""
    data = await request.json()
    pm_id = data.get("pmId", "default")
    url = data.get("url", "")

    s = await get_session(pm_id)
    try:
        await s["page"].goto(url, wait_until="domcontentloaded", timeout=30000)
        await s["page"].wait_for_timeout(3000)
        result = await take_screenshot_and_analyze(pm_id, f"Describe what you see on this page.")
        await save_session(pm_id)
        return web.json_response(result)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_action(request):
    """Perform a described action — Gemini figures out how."""
    data = await request.json()
    pm_id = data.get("pmId", "default")
    action_desc = data.get("action", "")

    s = await get_session(pm_id)
    page = s["page"]

    try:
        # Screenshot current state
        ss = await page.screenshot()
        plan = await ask_gemini_vision(ss,
            f"The user wants to: {action_desc}\n\n"
            "Looking at this page, what CSS selector should I click or what text should I look for? "
            "Give me a specific action: CLICK selector, TYPE selector text, or NAVIGATE url. "
            "Respond with the action type and target only.")

        # Execute the planned action
        plan_upper = plan.upper()
        if "CLICK" in plan_upper:
            # Extract selector
            parts = plan.split('"')
            if len(parts) >= 2:
                selector = parts[1]
                try:
                    await page.click(selector, timeout=5000)
                except Exception:
                    await page.get_by_text(selector, exact=False).first.click(timeout=5000)
            await page.wait_for_timeout(3000)
        elif "NAVIGATE" in plan_upper:
            url = plan.split()[-1]
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)

        result = await take_screenshot_and_analyze(pm_id, f"I just tried to: {action_desc}. What happened? What do you see now?")
        await save_session(pm_id)
        return web.json_response(result)

    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


async def handle_health(request):
    return web.json_response({
        "status": "ok",
        "sessions": list(sessions.keys()),
        "session_count": len(sessions),
    })


# ─── App Setup ───

app = web.Application()
app.router.add_post("/login", handle_login)
app.router.add_post("/2fa", handle_2fa)
app.router.add_post("/screenshot", handle_screenshot)
app.router.add_post("/inbox", handle_inbox)
app.router.add_post("/navigate", handle_navigate)
app.router.add_post("/action", handle_action)
app.router.add_get("/health", handle_health)

if __name__ == "__main__":
    print(f"Browser service starting on port {PORT}")
    web.run_app(app, port=PORT)
