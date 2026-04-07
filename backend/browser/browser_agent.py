"""
Host4Me Browser Agent — Direct Playwright with Gemini vision

Uses Playwright for browser control + Gemini for visual understanding.
Takes screenshots, sends them to Gemini for analysis, then acts.
Simpler and more reliable than browser-use wrapper.
"""

import asyncio
import base64
import json
import os
import sys
from pathlib import Path

import httpx
from playwright.async_api import async_playwright

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DATA_DIR = os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"


async def ask_gemini_vision(screenshot_bytes: bytes, prompt: str) -> str:
    """Send a screenshot to Gemini and get a text response."""
    b64 = base64.b64encode(screenshot_bytes).decode()
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/png", "data": b64}},
            ]
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(GEMINI_URL, json=payload)
        result = resp.json()
        return result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


async def login_airbnb(pm_id: str, email: str, password: str) -> dict:
    """Login to Airbnb using Playwright + Gemini vision."""
    session_dir = Path(DATA_DIR) / "sessions" / pm_id
    session_dir.mkdir(parents=True, exist_ok=True)
    storage_path = session_dir / "storage.json"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900},
            storage_state=str(storage_path) if storage_path.exists() else None,
        )
        page = await context.new_page()

        try:
            # Go to Airbnb login
            await page.goto("https://www.airbnb.com/login", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)

            # Screenshot and ask Gemini what we see
            ss = await page.screenshot()
            analysis = await ask_gemini_vision(ss, "What do you see on this page? Is this a login page? Is there an email input field? Describe the page briefly.")
            print(f"[Vision] Page analysis: {analysis[:200]}", file=sys.stderr)

            # Try to find and fill email
            email_selectors = ['input[type="email"]', 'input[name="email"]', '#email-login-email', 'input[data-testid="email-login-email"]']
            email_filled = False
            for sel in email_selectors:
                el = await page.query_selector(sel)
                if el:
                    await el.fill(email)
                    email_filled = True
                    break

            if not email_filled:
                # Try clicking "Continue with email" first
                for btn_text in ["Continue with email", "Email", "Log in with email"]:
                    try:
                        await page.get_by_text(btn_text, exact=False).first.click(timeout=3000)
                        await page.wait_for_timeout(2000)
                        for sel in email_selectors:
                            el = await page.query_selector(sel)
                            if el:
                                await el.fill(email)
                                email_filled = True
                                break
                        if email_filled:
                            break
                    except Exception:
                        continue

            if not email_filled:
                ss = await page.screenshot(path=str(session_dir / "login-fail.png"))
                await context.storage_state(path=str(storage_path))
                await browser.close()
                return {"status": "error", "message": "Could not find email input field"}

            # Click continue/submit
            submit = await page.query_selector('button[type="submit"]')
            if submit:
                await submit.click()
            await page.wait_for_timeout(3000)

            # Look for password field
            pw_el = await page.query_selector('input[type="password"]')
            if pw_el:
                await pw_el.fill(password)
                submit = await page.query_selector('button[type="submit"]')
                if submit:
                    await submit.click()
                await page.wait_for_timeout(5000)

            # Check what happened
            ss = await page.screenshot(path=str(session_dir / "login-result.png"))
            current_url = page.url

            # Ask Gemini to analyze the result
            analysis = await ask_gemini_vision(ss,
                "Analyze this page. Is the user logged in? Is there a 2FA/verification code prompt? "
                "Is there a CAPTCHA? Is there an error message? What page is this? "
                "Respond with exactly one of: LOGGED_IN, 2FA_REQUIRED, CAPTCHA, LOGIN_ERROR, UNKNOWN")

            print(f"[Vision] Login result: {analysis[:200]}", file=sys.stderr)

            await context.storage_state(path=str(storage_path))
            await browser.close()

            analysis_upper = analysis.upper()
            if "LOGGED_IN" in analysis_upper or "/hosting" in current_url:
                return {"status": "logged_in", "url": current_url, "analysis": analysis}
            elif "2FA" in analysis_upper:
                return {"status": "2fa_required", "analysis": analysis}
            elif "CAPTCHA" in analysis_upper:
                return {"status": "captcha", "analysis": analysis}
            elif "ERROR" in analysis_upper:
                return {"status": "login_failed", "analysis": analysis}
            else:
                return {"status": "unknown", "url": current_url, "analysis": analysis}

        except Exception as e:
            try:
                await page.screenshot(path=str(session_dir / "error.png"))
                await context.storage_state(path=str(storage_path))
                await browser.close()
            except Exception:
                pass
            return {"status": "error", "message": str(e)}


async def check_inbox(pm_id: str, platform: str = "airbnb") -> dict:
    """Check Airbnb inbox using Playwright + Gemini vision."""
    session_dir = Path(DATA_DIR) / "sessions" / pm_id
    storage_path = session_dir / "storage.json"

    if not storage_path.exists():
        return {"status": "auth_required", "message": "No saved session. Login first."}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900},
            storage_state=str(storage_path),
        )
        page = await context.new_page()

        try:
            await page.goto("https://www.airbnb.com/hosting/inbox", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(5000)

            if "/login" in page.url:
                await browser.close()
                return {"status": "auth_required"}

            ss = await page.screenshot(path=str(session_dir / "inbox.png"))

            # Ask Gemini to read the inbox
            analysis = await ask_gemini_vision(ss,
                "This is an Airbnb hosting inbox page. List ALL conversations visible in the left sidebar. "
                "For each conversation, provide: guest name, message preview, whether it looks unread, and the date. "
                "Format as JSON array: [{\"guest_name\": \"...\", \"preview\": \"...\", \"is_unread\": true/false, \"date\": \"...\"}]. "
                "Only include what you actually see. If the page is not an inbox, describe what you see instead.")

            await context.storage_state(path=str(storage_path))
            await browser.close()

            # Try to parse JSON from the response
            try:
                start = analysis.index("[")
                end = analysis.rindex("]") + 1
                messages = json.loads(analysis[start:end])
                return {"status": "ok", "messages": messages, "count": len(messages)}
            except (ValueError, json.JSONDecodeError):
                return {"status": "ok", "raw": analysis, "messages": [], "count": 0}

        except Exception as e:
            try:
                await browser.close()
            except Exception:
                pass
            return {"status": "error", "message": str(e)}


# CLI interface
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
    else:
        result = {"error": f"Unknown action: {action}"}

    print(json.dumps(result))
