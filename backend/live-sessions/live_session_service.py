"""
Host4Me Live Browser Session Service (Port 8101)

Launches headed Playwright browsers with Xvfb + noVNC so users can
log into Airbnb/VRBO through an embedded browser in the dashboard.

Anti-bot measures:
  1. Residential proxy (PROXY_SERVER env var) — routes browser traffic
     through real residential IPs so PerimeterX/HUMAN doesn't flag datacenter IP
  2. Playwright stealth — patches navigator.webdriver, chrome runtime, plugins,
     languages, WebGL, and other automation fingerprints
  3. Real Google Chrome binary — authentic TLS fingerprint (JA3/JA4)
  4. Realistic browser args — removes automation banners, disables blink
     automation detection
  5. Human-like viewport, user agent, timezone, locale

API contract (consumed by convex/onboarding.js):
  POST /sessions/create   { tenant_id, platform }  → { session_id, ws_port }
  POST /sessions/{id}/finish                        → { storage_state, cookie_count, final_url, status, platform }
  GET  /health                                      → { status, sessions }
"""

import asyncio
import json
import os
import signal
import subprocess
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PORT = int(os.environ.get("LIVE_SESSION_PORT", "8101"))
DATA_DIR = Path(os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data"))

# Residential proxy — format: http://user:pass@host:port
PROXY_SERVER = os.environ.get("PROXY_SERVER", "")
PROXY_USERNAME = os.environ.get("PROXY_USERNAME", "")
PROXY_PASSWORD = os.environ.get("PROXY_PASSWORD", "")

# VNC port range
VNC_PORT_START = int(os.environ.get("VNC_PORT_START", "6080"))
VNC_PORT_MAX = int(os.environ.get("VNC_PORT_MAX", "6099"))

# Platform start URLs
PLATFORM_URLS = {
    "airbnb": "https://www.airbnb.com/login",
    "vrbo": "https://www.vrbo.com",
    "booking": "https://account.booking.com/sign-in",
}

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
sessions: dict[str, dict] = {}
_next_display = 10
_next_vnc_port = VNC_PORT_START
_playwright = None
_scrape_xvfb_proc = None
_SCRAPE_DISPLAY = 50


# ---------------------------------------------------------------------------
# Stealth patches
# ---------------------------------------------------------------------------
STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = {
  runtime: {
    PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
    PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
    PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
    RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
    OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
    OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
  },
  loadTimes: function() { return {} },
  csi: function() { return {} },
  app: { isInstalled: false, InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed', DISABLED: 'disabled' }, RunningState: { RUNNING: 'running', CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run' } },
};
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const plugins = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ];
    plugins.refresh = () => {};
    return plugins;
  },
});
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
Object.defineProperty(navigator, 'connection', {
  get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false }),
});
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) return 'Intel Inc.';
  if (parameter === 37446) return 'Intel Iris OpenGL Engine';
  return getParameter.call(this, parameter);
};
const toBlob = HTMLCanvasElement.prototype.toBlob;
const toDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toBlob = function(...args) {
  const context = this.getContext('2d');
  if (context) { const style = context.fillStyle; context.fillStyle = 'rgba(0,0,0,0.01)'; context.fillRect(0, 0, 1, 1); context.fillStyle = style; }
  return toBlob.apply(this, args);
};
HTMLCanvasElement.prototype.toDataURL = function(...args) {
  const context = this.getContext('2d');
  if (context) { const style = context.fillStyle; context.fillStyle = 'rgba(0,0,0,0.01)'; context.fillRect(0, 0, 1, 1); context.fillStyle = style; }
  return toDataURL.apply(this, args);
};
delete window.__playwright;
delete window.__pw_manual;
delete window.__PW_inspect;
try {
  const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get: function() {
      const result = originalContentWindow.get.call(this);
      if (result) { try { Object.defineProperty(result.navigator, 'webdriver', { get: () => undefined }); } catch (e) {} }
      return result;
    },
  });
} catch (e) {}
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _alloc_display_and_port() -> tuple[int, int]:
    global _next_display, _next_vnc_port
    display = _next_display
    port = _next_vnc_port
    _next_display += 1
    _next_vnc_port += 1
    if _next_vnc_port > VNC_PORT_MAX:
        _next_vnc_port = VNC_PORT_START
    return display, port


def _start_xvfb(display: int, width=1280, height=900, depth=24) -> subprocess.Popen:
    proc = subprocess.Popen(
        ["Xvfb", f":{display}", "-screen", "0", f"{width}x{height}x{depth}", "-ac", "-nolisten", "tcp"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return proc


def _start_websockify(vnc_port: int, display: int) -> subprocess.Popen:
    vnc_display_port = 5900 + display
    x11vnc = subprocess.Popen(
        ["x11vnc", "-display", f":{display}", "-rfbport", str(vnc_display_port),
         "-nopw", "-forever", "-shared", "-noxrecord", "-noxfixes", "-noxdamage"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    websockify = subprocess.Popen(
        ["websockify", "--web", "/usr/share/novnc", str(vnc_port), f"localhost:{vnc_display_port}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return x11vnc, websockify


async def _apply_stealth(page):
    try:
        from playwright_stealth import stealth_async
        await stealth_async(page)
        return
    except ImportError:
        pass
    await page.add_init_script(STEALTH_JS)


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------
async def create_session(tenant_id: str, platform: str) -> dict:
    global _playwright
    try:
        from patchright.async_api import async_playwright as _new_playwright
        print("[session] Using patchright (CDP-patched Chromium)")
    except ImportError:
        from playwright.async_api import async_playwright as _new_playwright
        print("[session] patchright not found, falling back to playwright")

    if not _playwright:
        _playwright = await _new_playwright().start()

    session_id = str(uuid.uuid4())[:8]
    display, vnc_port = _alloc_display_and_port()

    xvfb_proc = _start_xvfb(display)
    await asyncio.sleep(0.5)

    x11vnc_proc, ws_proc = _start_websockify(vnc_port, display)
    await asyncio.sleep(0.5)

    browser_args = [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        f"--display=:{display}",
    ]

    proxy_config = None
    if PROXY_SERVER:
        proxy_config = {"server": PROXY_SERVER}
        if PROXY_USERNAME:
            proxy_config["username"] = PROXY_USERNAME
            proxy_config["password"] = PROXY_PASSWORD

    launch_kwargs = {"headless": False, "args": browser_args}
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

    browser = await _playwright.chromium.launch(**launch_kwargs)

    context_kwargs = {
        "viewport": {"width": 1280, "height": 900},
        "locale": "en-CA",
        "timezone_id": "America/Toronto",
        "color_scheme": "light",
        "has_touch": False,
        "is_mobile": False,
        "java_script_enabled": True,
    }

    context = await browser.new_context(**context_kwargs)
    page = await context.new_page()
    await _apply_stealth(page)

    sessions[session_id] = {
        "tenant_id": tenant_id,
        "platform": platform,
        "browser": browser,
        "context": context,
        "page": page,
        "display": display,
        "vnc_port": vnc_port,
        "xvfb": xvfb_proc,
        "x11vnc": x11vnc_proc,
        "websockify": ws_proc,
    }

    start_url = PLATFORM_URLS.get(platform, PLATFORM_URLS["airbnb"])

    async def _navigate_background():
        try:
            await page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
            print(f"[{session_id}] Navigated to {start_url} -> {page.url}")
        except Exception as e:
            print(f"[{session_id}] Warning: initial navigation error (non-fatal): {e}")

    asyncio.create_task(_navigate_background())

    print(f"[{session_id}] Session created: platform={platform}, display=:{display}, vnc_port={vnc_port}, proxy={'YES' if proxy_config else 'NO'}")
    return {"session_id": session_id, "ws_port": vnc_port}


async def finish_session(session_id: str) -> dict:
    s = sessions.get(session_id)
    if not s:
        raise ValueError(f"Session {session_id} not found")

    platform = s.get("platform", "")

    # For VRBO: navigate to host dashboard before saving state.
    # Try /p/ paths first (confirmed for Canadian accounts), then owner.vrbo.com as fallback.
    if platform == "vrbo":
        for vrbo_dash in [
            "https://www.vrbo.com/en-ca/p/properties",
            "https://www.vrbo.com/en-us/p/properties",
            "https://owner.vrbo.com/",
        ]:
            try:
                print(f"[{session_id}] VRBO: visiting {vrbo_dash} to capture host cookies...")
                await s["page"].goto(vrbo_dash, wait_until="networkidle", timeout=15000)
                await s["page"].wait_for_timeout(2000)
                print(f"[{session_id}] VRBO: landed at {s['page'].url}")
                if "/p/" in s["page"].url or "owner.vrbo.com" in s["page"].url:
                    break
            except Exception as owner_err:
                print(f"[{session_id}] VRBO: {vrbo_dash} navigation error (non-fatal): {owner_err}")

    storage_state = None
    cookie_count = 0
    final_url = ""
    try:
        final_url = s["page"].url
        storage_state = await s["context"].storage_state()
        cookie_count = len(storage_state.get("cookies", []))
    except Exception as e:
        print(f"[{session_id}] Error capturing state: {e}")

    try:
        await s["browser"].close()
    except Exception:
        pass

    for proc_name in ["websockify", "x11vnc", "xvfb"]:
        proc = s.get(proc_name)
        if proc:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    del sessions[session_id]
    print(f"[{session_id}] Session finished: {cookie_count} cookies captured from {final_url}")

    return {
        "status": "captured",
        "platform": platform,
        "storage_state": storage_state,
        "cookie_count": cookie_count,
        "final_url": final_url,
    }


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scrape_xvfb_proc
    print(f"Live Session Service starting on port {PORT}")
    if PROXY_SERVER:
        print(f"  Residential proxy: {PROXY_SERVER.split('@')[-1] if '@' in PROXY_SERVER else PROXY_SERVER}")
    else:
        print("  WARNING: No residential proxy configured. Set PROXY_SERVER env var.")
        print("  Bot detection WILL block datacenter IPs on VRBO/Airbnb.")

    try:
        _scrape_xvfb_proc = subprocess.Popen(
            ["Xvfb", f":{_SCRAPE_DISPLAY}", "-screen", "0", "1280x900x24", "-ac"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        import time; time.sleep(0.5)
        print(f"  Scrape display: :{_SCRAPE_DISPLAY} (non-headless scraping)")
    except Exception as e:
        print(f"  WARNING: Could not start scrape Xvfb: {e}")

    yield

    for sid in list(sessions.keys()):
        try:
            await finish_session(sid)
        except Exception:
            pass
    if _scrape_xvfb_proc:
        try:
            _scrape_xvfb_proc.terminate()
        except Exception:
            pass

app = FastAPI(title="Host4Me Live Sessions", version="2.0.0", lifespan=lifespan)


class CreateSessionRequest(BaseModel):
    tenant_id: str
    platform: str


@app.post("/sessions/create")
async def api_create_session(req: CreateSessionRequest):
    try:
        result = await create_session(req.tenant_id, req.platform)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sessions/{session_id}/finish")
async def api_finish_session(session_id: str):
    try:
        result = await finish_session(session_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Scrape listings using saved session cookies
# ---------------------------------------------------------------------------
class ScrapeRequest(BaseModel):
    storage_state: str
    platform: str
    start_url: str | None = None


async def scrape_vrbo_listings(context, page) -> list[dict]:
    listings = []
    try:
        await page.goto("https://www.vrbo.com/", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        current_url = page.url
        print(f"[scrape] After VRBO home, URL: {current_url}")

        for dashboard_url in [
            "https://www.vrbo.com/en-ca/host/properties",
            "https://www.vrbo.com/en-ca/p/properties",
            "https://www.vrbo.com/en-ca/p/home",
            "https://www.vrbo.com/en-us/host/properties",
            "https://www.vrbo.com/p/home",
            "https://www.vrbo.com/host/properties",
            "https://owner.vrbo.com/properties",
        ]:
            try:
                await page.goto(dashboard_url, wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(3000)
                if "/login" not in page.url and "/auth" not in page.url:
                    print(f"[scrape] Found dashboard at: {page.url}")
                    break
            except Exception as e:
                print(f"[scrape] {dashboard_url} failed: {e}")
                continue

        if "/login" in page.url or "/auth" in page.url:
            print("[scrape] Session expired - redirected to login")
            return []

        await page.wait_for_timeout(2000)
        page_content = await page.content()

        listing_elements = await page.query_selector_all('[data-testid*="property"], [class*="property-card"], [class*="listing"], .property-item, [data-stid*="property"]')

        if listing_elements:
            for el in listing_elements[:20]:
                try:
                    name = await el.query_selector('[class*="name"], [class*="title"], h2, h3')
                    name_text = await name.inner_text() if name else "Unknown Property"
                    location = await el.query_selector('[class*="location"], [class*="address"]')
                    location_text = await location.inner_text() if location else ""
                    listings.append({"name": name_text.strip(), "location": location_text.strip(), "platform": "vrbo"})
                except Exception as e:
                    print(f"[scrape] Error extracting listing element: {e}")
                    continue

        if not listings:
            try:
                all_text = await page.inner_text("body")
                print(f"[scrape] No listing elements found. Page text length: {len(all_text)}")
                print(f"[scrape] Page URL: {page.url}")
                print(f"[scrape] First 500 chars: {all_text[:500]}")
            except Exception:
                pass

        if not listings:
            try:
                api_response = await page.evaluate("""
                    async () => {
                        try {
                            const resp = await fetch('/api/host/properties', { credentials: 'include' });
                            if (resp.ok) return await resp.json();
                        } catch(e) {}
                        try {
                            const resp = await fetch('/en-us/host/api/properties', { credentials: 'include' });
                            if (resp.ok) return await resp.json();
                        } catch(e) {}
                        return null;
                    }
                """)
                if api_response and isinstance(api_response, list):
                    for prop in api_response:
                        listings.append({
                            "name": prop.get("name", prop.get("headline", "Unknown")),
                            "location": prop.get("location", prop.get("address", "")),
                            "platform": "vrbo",
                            "bedrooms": prop.get("bedrooms", 0),
                            "maxGuests": prop.get("maxGuests", prop.get("occupancy", 0)),
                        })
            except Exception as e:
                print(f"[scrape] API fetch failed: {e}")

    except Exception as e:
        print(f"[scrape] Error during VRBO scrape: {e}")

    return listings


async def scrape_listings_with_cookies(storage_state_json: str, platform: str) -> dict:
    global _playwright
    from playwright.async_api import async_playwright

    if not _playwright:
        _playwright = await async_playwright().start()

    try:
        storage_state = json.loads(storage_state_json)
    except json.JSONDecodeError as e:
        return {"status": "error", "message": f"Invalid storage state JSON: {e}", "listings": []}

    browser_args = [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--disable-dev-shm-usage",
        f"--display=:{_SCRAPE_DISPLAY}",
    ]

    proxy_config = None
    if PROXY_SERVER:
        proxy_config = {"server": PROXY_SERVER}
        if PROXY_USERNAME:
            proxy_config["username"] = PROXY_USERNAME
            proxy_config["password"] = PROXY_PASSWORD

    launch_kwargs = {"headless": False, "args": browser_args}
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

    browser = await _playwright.chromium.launch(**launch_kwargs)

    try:
        context = await browser.new_context(
            storage_state=storage_state,
            viewport={"width": 1280, "height": 900},
            locale="en-CA",
            timezone_id="America/Toronto",
        )
        page = await context.new_page()
        try:
            from playwright_stealth import stealth_async as _stealth
            await _stealth(page)
        except ImportError:
            await page.add_init_script(STEALTH_JS)

        if platform == "vrbo":
            listings = await scrape_vrbo_listings(context, page)
        else:
            listings = []

        screenshot_path = DATA_DIR / "last_scrape.png"
        try:
            await page.screenshot(path=str(screenshot_path))
        except Exception:
            pass

        return {"status": "ok", "platform": platform, "listings": listings, "count": len(listings), "final_url": page.url}
    finally:
        await browser.close()


@app.post("/scrape-listings")
async def api_scrape_listings(req: ScrapeRequest):
    try:
        result = await scrape_listings_with_cookies(req.storage_state, req.platform)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Scrape RESERVATIONS using saved session cookies
# ---------------------------------------------------------------------------

async def _launch_stealth_browser(storage_state_json: str):
    global _playwright
    try:
        from patchright.async_api import async_playwright as _new_playwright
        print("[scrape] Using patchright (CDP-patched Chromium)")
    except ImportError:
        from playwright.async_api import async_playwright as _new_playwright
        print("[scrape] patchright not found, falling back to playwright")
    if not _playwright:
        _playwright = await _new_playwright().start()

    storage_state = json.loads(storage_state_json)
    browser_args = [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        f"--display=:{_SCRAPE_DISPLAY}",
    ]
    proxy_config = None
    if PROXY_SERVER:
        proxy_config = {"server": PROXY_SERVER}
        if PROXY_USERNAME:
            proxy_config["username"] = PROXY_USERNAME
            proxy_config["password"] = PROXY_PASSWORD

    launch_kwargs = {"headless": False, "args": browser_args}
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

    browser = await _playwright.chromium.launch(**launch_kwargs)
    context = await browser.new_context(
        storage_state=storage_state,
        viewport={"width": 1280, "height": 900},
        locale="en-CA",
        timezone_id="America/Toronto",
    )
    page = await context.new_page()
    try:
        from playwright_stealth import stealth_async as _stealth
        await _stealth(page)
    except ImportError:
        await page.add_init_script(STEALTH_JS)

    return browser, context, page


async def scrape_vrbo_reservations(page, start_url: str | None = None) -> dict:
    """Scrape reservations + listings from VRBO host dashboard via network interception.

    VRBO is a React SPA - DOM scraping is unreliable because class names are hashed
    and data loads asynchronously via internal GraphQL / REST APIs. Instead we:
      1. Wire up page.on('response', ...) BEFORE navigating so we capture every
         API response that the page issues during its normal data-loading lifecycle.
      2. Navigate to the reservations page and wait generously for XHR to complete.
      3. Parse captured JSON payloads to extract reservation and property records.
      4. Fall back to GraphQL introspection fetch and page-text heuristics if needed.

    start_url: the finalUrl captured when the user last logged in (stored in Convex).
               Used to infer the correct locale prefix (e.g. /en-ca/) so we navigate
               directly to the right domain+path instead of guessing.
    """
    reservations = []
    listings = []
    debug_page_text = ""
    debug_urls_visited = []
    captured_api_responses = []
    captured_graphql_requests = []

    # 1. Wire up network interception BEFORE any navigation
    async def handle_response(response):
        url = response.url
        try:
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            status = response.status
            if status < 200 or status >= 400:
                return
            content_length = int(response.headers.get("content-length", "999"))
            if content_length < 50:
                return
            body = await response.json()
            body_str = str(body)
            has_data = any(k in body_str.lower() for k in (
                "reservation", "booking", "listing", "property", "propert",
                "graphql", "host", "traveler", "accommodation", "stay",
                "check_in", "checkin", "check-in", "unit", "rental",
            ))
            if has_data or ("vrbo" in url.lower() or "expedia" in url.lower()):
                captured_api_responses.append({"url": url, "body": body})
                print(f"[vrbo-net] Captured {url} (status={status})")
        except Exception as capture_err:
            print(f"[vrbo-net] Could not capture {url}: {capture_err}")

    def handle_request_sync(request):
        url = request.url
        try:
            if "graphql" in url.lower() and request.method == "POST":
                post_data = request.post_data or ""
                if post_data and len(post_data) > 10:
                    captured_graphql_requests.append({"url": url, "body": post_data})
                    print(f"[vrbo-gql-req] Intercepted GraphQL POST {url[:80]}: {post_data[:200]}")
        except Exception:
            pass

    page.on("response", handle_response)
    page.on("request", handle_request_sync)

    try:
        NOT_FOUND_SIGNALS = [
            "page cannot be found", "page not found", "404",
            "doesn't exist", "no longer available",
        ]
        landed_url = ""

        # Determine base URL and locale prefix from stored finalUrl
        locale_base = "https://www.vrbo.com/en-ca"
        if start_url:
            import re
            from urllib.parse import urlparse
            parsed = urlparse(start_url)
            m = re.match(r"^/(en-[a-z]{2})/", parsed.path)
            if m:
                locale_base = f"{parsed.scheme}://{parsed.netloc}/{m.group(1)}"

        # Strategy A: load authenticated homepage to capture SPA bootstrap API calls
        homepage = f"{locale_base}/"
        print(f"[vrbo-res] Loading authenticated homepage: {homepage}")
        try:
            await page.goto(homepage, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)
            landed_url = page.url
            debug_urls_visited.append({"attempted": homepage, "landed": landed_url})
        except Exception as e:
            print(f"[vrbo-res] Homepage load error: {e}")
            debug_urls_visited.append({"attempted": homepage, "error": str(e)})

        if "/login" in page.url or "/auth" in page.url:
            return {"reservations": [], "listings": [],
                    "debug_page_text": "SESSION EXPIRED", "debug_urls_visited": debug_urls_visited}

        # Strategy B: find host/owner portal link in the DOM
        print("[vrbo-res] Searching DOM for host portal link...")
        try:
            owner_href = await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                const candidate = links.find(a => {
                    const h = (a.href || '').toLowerCase();
                    const t = (a.textContent || '').toLowerCase().trim();
                    return h.includes('/p/reservations') || h.includes('/p/properties') ||
                           h.includes('owner.vrbo') || h.includes('/host') ||
                           t.includes('host dashboard') || t.includes('my properties') ||
                           t.includes('switch to hosting') || t.includes('owner') ||
                           t.includes('dashboard') || t.includes('inbox');
                });
                return candidate ? candidate.href : null;
            }""")
            if owner_href:
                print(f"[vrbo-res] Found host portal link: {owner_href}")
                await page.goto(owner_href, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(4000)
                landed_url = page.url
                debug_urls_visited.append({"attempted": owner_href, "landed": landed_url})
        except Exception as e:
            print(f"[vrbo-res] DOM host-link search error: {e}")

        try:
            context_cookies = await page.context.cookies()
            vrbo_domains = list({c["domain"] for c in context_cookies if "vrbo" in c["domain"].lower() or "expedia" in c["domain"].lower()})
            print(f"[vrbo-diag] Cookie domains: {vrbo_domains}")
        except Exception as diag_err:
            print(f"[vrbo-diag] Cookie domain check failed: {diag_err}")

        import re as _re

        # Strategy C: try host dashboard URLs
        # /p/ path is the correct modern VRBO host dashboard (confirmed for Canadian en-ca accounts).
        # owner.vrbo.com is US-only legacy and also fails with SOCKS proxy errors.
        host_dashboard_already = any(
            "/p/reservations" in page.url or "/p/properties" in page.url
            or "owner.vrbo.com" in page.url
            for _ in [None]
        )
        if not host_dashboard_already:
            owner_urls = [
                f"{locale_base}/p/reservations",   # Canadian /en-ca/p/ path (confirmed)
                f"{locale_base}/p/properties",
                f"{locale_base}/p/calendar",
                "https://owner.vrbo.com/reservations",  # US accounts fallback
                "https://owner.vrbo.com/",
            ]
            for url in owner_urls:
                try:
                    print(f"[vrbo-res] Trying: {url}")
                    await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    await page.wait_for_timeout(4000)
                    landed_url = page.url
                    print(f"[vrbo-res] After nav to {url} -> landed at: {landed_url}")
                    if "/login" in landed_url or "/auth" in landed_url:
                        debug_urls_visited.append({"attempted": url, "landed": landed_url, "error": "login redirect"})
                        continue
                    body_text = ""
                    try:
                        body_text = (await page.inner_text("body")).lower()
                    except Exception:
                        pass
                    if any(sig in body_text for sig in NOT_FOUND_SIGNALS):
                        debug_urls_visited.append({"attempted": url, "landed": landed_url, "error": "page not found"})
                        print(f"[vrbo-res] 404 at {url}, trying next...")
                        continue
                    debug_urls_visited.append({"attempted": url, "landed": landed_url})
                    print(f"[vrbo-res] SUCCESS Landed at: {landed_url}")
                    break
                except Exception as nav_err:
                    debug_urls_visited.append({"attempted": url, "error": str(nav_err)})
                    continue

        # Strategy C2: navigate to host-specific pages to trigger SPA API calls.
        # Priority: /p/ paths (modern VRBO) then legacy /host/ paths.
        c2_pages = [
            f"{locale_base}/p/reservations",
            f"{locale_base}/p/properties",
            f"https://www.vrbo.com/host/reservations",
            f"https://www.vrbo.com/host/listings",
        ]
        for host_page in c2_pages:
            if "/p/reservations" in page.url or "/p/properties" in page.url or "owner.vrbo.com" in page.url:
                break
            try:
                print(f"[vrbo-res] Trying host page: {host_page}")
                await page.goto(host_page, wait_until="networkidle", timeout=20000)
                await page.wait_for_timeout(3000)
                landed = page.url
                print(f"[vrbo-res] host page landed: {landed}")
                debug_urls_visited.append({"attempted": host_page, "landed": landed})
                if "owner.vrbo.com" in landed or "/p/" in landed or "/host" in landed:
                    await page.wait_for_timeout(5000)
                    break
            except Exception as e:
                print(f"[vrbo-res] {host_page} error: {e}")

        await page.wait_for_timeout(5000)

        # Strategy D: navigate back to www.vrbo.com, extract IDs, try targeted APIs
        try:
            print(f"[vrbo-res] Navigating back to www.vrbo.com for targeted API calls...")
            await page.goto(f"{locale_base}/", wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(2000)
        except Exception:
            pass

        vrbo_property_id = None
        vrbo_user_id = None
        for cap in captured_api_responses:
            m = _re.search(r"/gc/memberDetails/(\d+)/(\d+)/", cap.get("url", ""))
            if m:
                vrbo_property_id, vrbo_user_id = m.group(1), m.group(2)
                print(f"[vrbo-diag] Extracted IDs - property: {vrbo_property_id}, user: {vrbo_user_id}")
                break

        if vrbo_user_id:
            uid = vrbo_user_id
            targeted_apis = [
                f"/gc/booking/hosted/{uid}",
                f"/gc/reservation/inbox/{uid}",
                f"/api/v2/host/reservations?userId={uid}",
                f"/api/host/inbox?hostId={uid}",
                f"/gc/host/{uid}/properties",
            ]
            for api_path in targeted_apis:
                full_url = f"https://www.vrbo.com{api_path}"
                await asyncio.sleep(1.5)
                try:
                    resp = await page.evaluate(f"""
                        async () => {{
                            try {{
                                const headers = {{
                                    'Accept': 'application/json',
                                    'X-Requested-With': 'XMLHttpRequest',
                                }};
                                let r = await fetch('{full_url}', {{
                                    credentials: 'include',
                                    headers,
                                }});
                                if (r.status === 429) {{
                                    await new Promise(res => setTimeout(res, 10000));
                                    r = await fetch('{full_url}', {{
                                        credentials: 'include',
                                        headers,
                                    }});
                                }}
                                const text = await r.text();
                                let isJson = false;
                                try {{ JSON.parse(text); isJson = true; }} catch {{}}
                                return {{ status: r.status, isJson, body: text.substring(0, 600) }};
                            }} catch(e) {{ return {{ error: e.toString() }}; }}
                        }}
                    """)
                    print(f"[vrbo-api] {api_path} -> status={resp.get('status')} isJson={resp.get('isJson')} body={resp.get('body','')[:300]!r}")
                    if resp.get("status") == 200 and resp.get("isJson"):
                        try:
                            body = json.loads(resp["body"])
                            captured_api_responses.append({"url": full_url, "body": body})
                            print(f"[vrbo-api] SUCCESS - added to captured responses")
                        except Exception:
                            pass
                except Exception as e:
                    print(f"[vrbo-api] {api_path} error: {e}")

        # Strategy E: GraphQL
        if captured_graphql_requests:
            print(f"[vrbo-gql] Replaying {len(captured_graphql_requests)} intercepted GraphQL request(s)...")
            for gql_req in captured_graphql_requests[:5]:
                gql_url = gql_req["url"]
                gql_body = gql_req["body"]
                try:
                    result = await page.evaluate("""
                        async (url, body) => {
                            try {
                                const r = await fetch(url, {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                                    body,
                                });
                                const text = await r.text();
                                return { status: r.status, body: text.substring(0, 500) };
                            } catch(e) { return { error: e.toString() }; }
                        }
                    """, gql_url, gql_body)
                    print(f"[vrbo-gql] Replay {gql_url}: {result}")
                    if result.get("status") == 200:
                        try:
                            body = json.loads(result["body"])
                            captured_api_responses.append({"url": gql_url, "body": body})
                            print(f"[vrbo-gql] SUCCESS - added replay response to captured")
                        except Exception:
                            pass
                except Exception as e:
                    print(f"[vrbo-gql] Replay error: {e}")
        else:
            print("[vrbo-res] No intercepted GraphQL. Trying known operation names...")
            gql_url = "https://www.vrbo.com/graphql"
            gql_queries = [
                '{"operationName":"HostReservations","query":"query HostReservations($startDate:String,$endDate:String){hostReservations(startDate:$startDate,endDate:$endDate){items{id confirmationCode checkIn checkOut status guest{displayName}}}}","variables":{"startDate":"2024-01-01","endDate":"2027-01-01"}}',
                '{"operationName":"HostInbox","query":"query HostInbox{hostInbox{reservations{id checkIn checkOut guestName status}}}","variables":{}}',
                '{"operationName":"PropertyReservations","query":"query PropertyReservations{propertyReservations{reservations{id arrivalDate departureDate}}}","variables":{}}',
            ]
            for i, gql_body in enumerate(gql_queries):
                await asyncio.sleep(1.0)
                try:
                    result = await page.evaluate("""
                        async (url, body) => {
                            try {
                                const r = await fetch(url, {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                                    body,
                                });
                                const text = await r.text();
                                return { status: r.status, isHtml: text.trim().startsWith('<'), body: text.substring(0, 300) };
                            } catch(e) { return { error: e.toString() }; }
                        }
                    """, gql_url, gql_body)
                    print(f"[vrbo-gql] query[{i}]: {result}")
                except Exception as e:
                    print(f"[vrbo-gql] query[{i}] error: {e}")

        try:
            await page.screenshot(path=str(DATA_DIR / "vrbo_reservations_debug.png"), full_page=True)
        except Exception:
            pass

        # Strategy F: direct HTTP requests (bypass browser proxy entirely)
        if vrbo_user_id and not reservations:
            try:
                import httpx as _httpx
                ctx_cookies = await page.context.cookies()
                cookie_jar = {
                    c["name"]: c["value"]
                    for c in ctx_cookies
                    if "vrbo" in c.get("domain", "").lower()
                    or "expedia" in c.get("domain", "").lower()
                }
                print(f"[vrbo-direct] Using {len(cookie_jar)} cookies for direct HTTP requests")
                ua = (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                )
                direct_headers = {
                    "Accept": "application/json",
                    "Accept-Language": "en-CA,en;q=0.9",
                    "User-Agent": ua,
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": "https://www.vrbo.com/",
                }
                uid = vrbo_user_id
                direct_endpoints = [
                    f"https://www.vrbo.com/gc/booking/hosted/{uid}",
                    f"https://www.vrbo.com/gc/reservation/inbox/{uid}",
                    f"https://owner.vrbo.com/api/v1/reservations",
                    f"https://owner.vrbo.com/api/v1/properties",
                    f"https://owner.vrbo.com/api/reservations",
                    f"https://owner.vrbo.com/graphql",
                ]
                async with _httpx.AsyncClient(
                    follow_redirects=True,
                    timeout=20.0,
                    cookies=cookie_jar,
                    headers=direct_headers,
                ) as client:
                    for endpoint in direct_endpoints:
                        try:
                            await asyncio.sleep(1.0)
                            resp = await client.get(endpoint)
                            body_text = resp.text
                            is_json = False
                            parsed = None
                            try:
                                parsed = resp.json()
                                is_json = True
                            except Exception:
                                pass
                            print(
                                f"[vrbo-direct] {endpoint} -> "
                                f"status={resp.status_code} isJson={is_json} "
                                f"body={body_text[:200]!r}"
                            )
                            if resp.status_code == 200 and is_json and parsed:
                                captured_api_responses.append({"url": endpoint, "body": parsed})
                                print(f"[vrbo-direct] SUCCESS - added to captured responses")
                        except Exception as req_err:
                            print(f"[vrbo-direct] {endpoint} error: {req_err}")
            except ImportError:
                print("[vrbo-direct] httpx not available - skipping direct HTTP strategy")
            except Exception as direct_err:
                print(f"[vrbo-direct] Strategy failed: {direct_err}")

        # 3. Parse captured network responses
        def _extract_from_blob(blob):
            found_res = []
            found_list = []

            def _walk(obj, depth=0):
                if depth > 10:
                    return
                if isinstance(obj, list):
                    for item in obj:
                        _walk(item, depth + 1)
                elif isinstance(obj, dict):
                    keys_lower = {k.lower(): k for k in obj}
                    has_guest = any(k in keys_lower for k in (
                        "guestname", "travelername", "traveler", "guest", "customername",
                        "reserveename", "reservee",
                    ))
                    has_dates = any(k in keys_lower for k in (
                        "checkin", "checkout", "arrivaldate", "departuredate",
                        "startdate", "enddate", "checkindate", "checkoutdate",
                    ))
                    has_res_id = any(k in keys_lower for k in (
                        "reservationid", "reservationnumber", "bookingid", "confirmationcode",
                        "orderid", "id",
                    ))
                    if (has_guest or has_dates) and (has_res_id or has_dates):
                        def _get(*candidates):
                            for c in candidates:
                                val = obj.get(keys_lower.get(c, "__miss__"))
                                if val is not None and val != "":
                                    return val
                            return None

                        guest = _get("guestname", "travelername", "traveler", "guest", "customername")
                        if isinstance(guest, dict):
                            guest = guest.get("fullName", guest.get("name", str(guest)))
                        check_in = _get("checkin", "checkindate", "arrivaldate", "startdate")
                        check_out = _get("checkout", "checkoutdate", "departuredate", "enddate")
                        prop = _get("propertyname", "listingname", "unitname", "property", "listing")
                        if isinstance(prop, dict):
                            prop = prop.get("name", prop.get("headline", str(prop)))
                        status = _get("status", "bookingstatus", "reservationstatus") or "confirmed"
                        res_id = _get("reservationid", "reservationnumber", "bookingid", "confirmationcode", "id")
                        guests_count = _get("guestcount", "numberofguests", "adultcount", "guests")
                        payout = _get("payout", "totalpayout", "grossearnings", "hostpayout")

                        if guest or (check_in and check_out):
                            found_res.append({
                                "guestName": str(guest).strip() if guest else "Unknown",
                                "checkIn": str(check_in) if check_in else "",
                                "checkOut": str(check_out) if check_out else "",
                                "propertyName": str(prop).strip() if prop else "",
                                "status": _normalize_status(str(status)),
                                "guests": guests_count,
                                "payout": payout,
                                "reservationId": str(res_id) if res_id else None,
                            })
                            return

                    has_listing_name = any(k in keys_lower for k in (
                        "headline", "propertyname", "listingname", "unitname", "propertytitle",
                    ))
                    if has_listing_name and not has_guest:
                        def _getl(*candidates):
                            for c in candidates:
                                val = obj.get(keys_lower.get(c, "__miss__"))
                                if val is not None and val != "":
                                    return val
                            return None
                        name = _getl("headline", "propertyname", "listingname", "unitname", "propertytitle")
                        loc = _getl("city", "location", "address")
                        if isinstance(loc, dict):
                            loc = loc.get("city", loc.get("address", ""))
                        if name:
                            found_list.append({
                                "name": str(name).strip(),
                                "location": str(loc).strip() if loc else "",
                                "platform": "vrbo",
                            })
                            return

                    for v in obj.values():
                        _walk(v, depth + 1)

            _walk(blob)
            return found_res, found_list

        seen_res_ids = set()
        seen_listing_names = set()

        for capture in captured_api_responses:
            blob = capture["body"]
            res_found, list_found = _extract_from_blob(blob)
            for r in res_found:
                key = r.get("reservationId") or f"{r['guestName']}|{r['checkIn']}"
                if key not in seen_res_ids:
                    seen_res_ids.add(key)
                    reservations.append(r)
            for l in list_found:
                if l["name"] not in seen_listing_names:
                    seen_listing_names.add(l["name"])
                    listings.append(l)

        print(f"[vrbo-net] After network capture: {len(reservations)} reservations, {len(listings)} listings")

        import json as _json
        for i, cap in enumerate(captured_api_responses[:15]):
            url_short = cap.get("url", "")[-70:]
            body = cap.get("body", {})
            if "uisprime" in url_short or "evaluateExperiment" in url_short:
                continue
            if isinstance(body, dict):
                top_keys = list(body.keys())[:8]
                snippet = _json.dumps(body)[:150]
            elif isinstance(body, list):
                top_keys = f"list[{len(body)}]"
                snippet = _json.dumps(body[0] if body else {})[:150]
            else:
                top_keys = type(body).__name__
                snippet = str(body)[:150]
            print(f"[vrbo-diag] cap[{i}] {url_short}")
            print(f"  keys={top_keys} | {snippet}")

        # 4. If network capture missed everything, fire explicit API fetches
        if not reservations:
            try:
                api_data = await page.evaluate("""
                    async () => {
                        const endpoints = [
                            '/api/host/reservations',
                            '/en-us/host/api/reservations',
                            '/en-ca/host/api/reservations',
                            '/api/v2/host/reservations',
                            '/host/api/reservations',
                        ];
                        for (const url of endpoints) {
                            try {
                                const r = await fetch(url, {
                                    credentials: 'include',
                                    headers: { 'Accept': 'application/json' },
                                });
                                if (r.ok) {
                                    const data = await r.json();
                                    return { url, data };
                                }
                            } catch(e) {}
                        }
                        return null;
                    }
                """)
                if api_data:
                    print(f"[vrbo-res] API fetch hit: {api_data.get('url')}")
                    blob = api_data.get("data", {})
                    items = blob if isinstance(blob, list) else (
                        blob.get("reservations", blob.get("items", blob.get("data", [])))
                    )
                    for item in (items if isinstance(items, list) else []):
                        reservations.append({
                            "guestName": str(item.get("guestName", item.get("travelerName", "Unknown"))).strip(),
                            "checkIn": item.get("checkIn", item.get("arrivalDate", "")),
                            "checkOut": item.get("checkOut", item.get("departureDate", "")),
                            "propertyName": item.get("propertyName", item.get("listingName", "")),
                            "status": _normalize_status(str(item.get("status", "confirmed"))),
                            "guests": item.get("guestCount", item.get("numberOfGuests")),
                            "payout": item.get("payout", item.get("totalPayout")),
                            "reservationId": item.get("reservationId", item.get("id")),
                        })
            except Exception as api_err:
                print(f"[vrbo-res] Explicit API fetch failed: {api_err}")

        # 5. Also navigate to properties page for listings
        if not listings:
            listing_urls = [
                f"{locale_base}/p/properties",   # /en-ca/p/properties (confirmed correct)
                f"{locale_base}/p/reservations",
                f"{locale_base}/host/properties",
                "https://owner.vrbo.com/listings",
                "https://owner.vrbo.com/properties",
            ]
            for url in listing_urls:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    await page.wait_for_timeout(5000)
                    if "/login" in page.url or "/auth" in page.url:
                        continue
                    try:
                        body_text = (await page.inner_text("body")).lower()
                        if any(sig in body_text for sig in NOT_FOUND_SIGNALS):
                            debug_urls_visited.append({"attempted": url, "landed": page.url, "error": "page not found"})
                            continue
                    except Exception:
                        pass
                    debug_urls_visited.append({"attempted": url, "landed": page.url})
                    break
                except Exception:
                    continue

            for capture in captured_api_responses:
                blob = capture["body"]
                _, list_found = _extract_from_blob(blob)
                for l in list_found:
                    if l["name"] not in seen_listing_names:
                        seen_listing_names.add(l["name"])
                        listings.append(l)

        # 6. Page-text fallback for debug
        if not reservations:
            try:
                all_text = await page.inner_text("body")
                debug_page_text = all_text[:3000]
                print(f"[vrbo-res] Page text ({len(all_text)} chars): {all_text[:300]}")
            except Exception:
                pass
        else:
            debug_page_text = f"network-interception: {len(reservations)} reservations, {len(listings)} listings"

        print(f"[vrbo-res] Final: {len(reservations)} reservations, {len(listings)} listings")
        print(f"[vrbo-res] Captured {len(captured_api_responses)} API responses")

    except Exception as e:
        print(f"[vrbo-res] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        debug_page_text = f"ERROR: {e}"
    finally:
        try:
            page.remove_listener("response", handle_response)
        except Exception:
            pass

    return {
        "reservations": reservations,
        "listings": listings,
        "debug_page_text": debug_page_text,
        "debug_urls_visited": debug_urls_visited,
    }


async def scrape_airbnb_reservations(page) -> dict:
    reservations = []
    listings = []
    captured = []

    async def handle_response(response):
        url = response.url
        try:
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            if response.status < 200 or response.status >= 400:
                return
            if not any(k in url for k in [
                "airbnb.com/api", "api/v3", "reservations", "listing",
                "hosting", "stays", "trips", "inbox", "graphql",
            ]):
                return
            body = await response.json()
            body_str = str(body).lower()
            if any(k in body_str for k in [
                "reservation", "booking", "checkin", "checkout",
                "guest", "listing", "property",
            ]):
                captured.append({"url": url, "body": body})
                print(f"[airbnb-net] Captured {url[:80]} (status={response.status})")
        except Exception:
            pass

    page.on("response", handle_response)

    try:
        print("[airbnb-res] Loading hosting/reservations...")
        await page.goto("https://www.airbnb.com/hosting/reservations",
                        wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(4000)

        if "/login" in page.url or "/authenticate" in page.url:
            print("[airbnb-res] Session expired - redirected to login")
            return {"reservations": [], "listings": [], "debug_page_text": "SESSION EXPIRED"}

        print(f"[airbnb-res] Landed at: {page.url}")
        print(f"[airbnb-res] Captured {len(captured)} API responses so far")

        try:
            await page.goto("https://www.airbnb.com/hosting/listings",
                            wait_until="networkidle", timeout=25000)
            await page.wait_for_timeout(3000)
            print(f"[airbnb-res] Captured {len(captured)} API responses after listings page")
        except Exception:
            pass

        def _walk(obj, depth=0):
            if depth > 12 or obj is None:
                return
            if isinstance(obj, list):
                for item in obj:
                    _walk(item, depth + 1)
            elif isinstance(obj, dict):
                keys_l = {k.lower(): k for k in obj}
                has_guest = any(k in keys_l for k in (
                    "guest", "guestname", "guest_name", "guest_user",
                    "guestdetails", "reservee", "traveler",
                ))
                has_dates = any(k in keys_l for k in (
                    "checkin", "checkout", "check_in", "check_out",
                    "start_date", "end_date", "checkindate", "checkoutdate",
                    "arrival_date", "departure_date",
                ))
                has_id = any(k in keys_l for k in (
                    "confirmation_code", "confirmationcode", "reservation_id",
                    "reservationid", "code", "id",
                ))
                if (has_guest or has_dates) and has_id:
                    def _get(*candidates):
                        for c in candidates:
                            v = obj.get(keys_l.get(c, "__miss__"))
                            if v is not None and v != "":
                                return str(v)
                        return ""
                    guest_raw = obj.get(keys_l.get("guest") or keys_l.get("guest_user", "__miss__"), {})
                    guest_name = ""
                    if isinstance(guest_raw, dict):
                        guest_name = (guest_raw.get("full_name") or guest_raw.get("name")
                                      or guest_raw.get("first_name") or "")
                    if not guest_name:
                        guest_name = _get("guestname", "guest_name", "reservee")
                    check_in  = _get("checkin", "check_in", "checkindate", "start_date", "arrival_date")
                    check_out = _get("checkout", "check_out", "checkoutdate", "end_date", "departure_date")
                    code      = _get("confirmation_code", "confirmationcode", "reservation_id", "code", "id")
                    status    = _get("status", "state", "reservation_status")
                    prop_name = _get("listing_name", "property_name", "listing_title")
                    if not prop_name:
                        listing = obj.get(keys_l.get("listing", "__miss__"), {})
                        if isinstance(listing, dict):
                            prop_name = listing.get("name") or listing.get("title") or ""
                    if guest_name or (check_in and check_out):
                        reservations.append({
                            "guestName": guest_name,
                            "checkIn": check_in[:10] if check_in else "",
                            "checkOut": check_out[:10] if check_out else "",
                            "confirmationCode": code,
                            "propertyName": str(prop_name),
                            "status": _normalize_status(status or "confirmed"),
                            "platform": "airbnb",
                        })
                        return
                if "listing_id" in keys_l or ("name" in keys_l and "listing" in str(obj).lower()):
                    name = obj.get(keys_l.get("name", "__miss__")) or obj.get(keys_l.get("title", "__miss__"), "")
                    lid  = obj.get(keys_l.get("listing_id", "__miss__")) or obj.get(keys_l.get("id", "__miss__"), "")
                    if name:
                        listings.append({
                            "name": str(name),
                            "platform": "airbnb",
                            "externalId": str(lid) if lid else "",
                        })
                for v in obj.values():
                    _walk(v, depth + 1)

        for cap in captured:
            _walk(cap.get("body"))

        seen_codes = set()
        deduped = []
        for r in reservations:
            key = r.get("confirmationCode") or f"{r['guestName']}_{r['checkIn']}"
            if key not in seen_codes:
                seen_codes.add(key)
                deduped.append(r)
        reservations = deduped

        seen_names = set()
        listings = [l for l in listings if l["name"] not in seen_names and not seen_names.add(l["name"])]

        print(f"[airbnb-res] Final: {len(reservations)} reservations, {len(listings)} listings")
        print(f"[airbnb-res] Captured {len(captured)} API responses total")

        if not reservations:
            print("[airbnb-res] No API data - trying DOM fallback...")
            try:
                await page.goto("https://www.airbnb.com/hosting/reservations",
                                wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(3000)
                els = await page.query_selector_all(
                    '[data-testid*="reservation"], [data-testid*="trip"], '
                    '[class*="reservation"], table tbody tr'
                )
                for el in els[:50]:
                    try:
                        text = await el.inner_text()
                        lines = [l.strip() for l in text.split("\n") if l.strip()]
                        if len(lines) >= 2:
                            months = ["jan","feb","mar","apr","may","jun",
                                      "jul","aug","sep","oct","nov","dec"]
                            guest = lines[0]
                            dates_str = next((l for l in lines if any(m in l.lower() for m in months)), "")
                            check_in, check_out = _parse_date_range(dates_str)
                            prop = next((l for l in lines[1:] if l and l != guest and l != dates_str), "")
                            status = next((l for l in lines if l.lower() in
                                           ["confirmed","pending","cancelled","completed","upcoming"]), "confirmed")
                            if guest and (check_in or dates_str):
                                reservations.append({
                                    "guestName": guest,
                                    "checkIn": check_in,
                                    "checkOut": check_out,
                                    "propertyName": prop,
                                    "status": _normalize_status(status),
                                    "platform": "airbnb",
                                })
                    except Exception:
                        pass
                print(f"[airbnb-res] DOM fallback found {len(reservations)} reservations")
            except Exception as dom_err:
                print(f"[airbnb-res] DOM fallback error: {dom_err}")

    except Exception as e:
        print(f"[airbnb-res] Error: {e}")

    return {
        "reservations": reservations,
        "listings": listings,
        "debug_urls_visited": [{"landed": page.url}],
    }


async def scrape_booking_reservations(page) -> dict:
    reservations = []
    listings = []
    try:
        await page.goto("https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking_reservations.html", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)
        if "sign-in" in page.url or "login" in page.url:
            print("[booking-res] Session expired")
            return {"reservations": [], "listings": []}
        print(f"[booking-res] At: {page.url}")
        rows = await page.query_selector_all('table tbody tr, [class*="reservation-row"], [class*="booking-item"]')
        for row in rows[:50]:
            try:
                text = await row.inner_text()
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                if len(lines) >= 2:
                    guest = lines[0]
                    dates_str = " ".join(lines[1:3])
                    check_in, check_out = _parse_date_range(dates_str)
                    status = next((l for l in lines if l.lower() in ["confirmed", "no-show", "cancelled"]), "confirmed")
                    if guest:
                        reservations.append({
                            "guestName": guest,
                            "checkIn": check_in,
                            "checkOut": check_out,
                            "propertyName": "",
                            "status": _normalize_status(status),
                        })
            except Exception:
                pass
    except Exception as e:
        print(f"[booking-res] Error: {e}")
    return {"reservations": reservations, "listings": listings}


def _parse_date_range(text: str) -> tuple[str, str]:
    import re
    from datetime import datetime
    if not text:
        return ("", "")
    parts = re.split(r'\s*[-\u2013\u2014]\s*|\s+to\s+', text, maxsplit=1)
    if len(parts) != 2:
        return ("", "")
    formats = [
        "%b %d, %Y", "%b %d %Y", "%B %d, %Y", "%B %d %Y",
        "%m/%d/%Y", "%Y-%m-%d", "%d %b %Y", "%d %B %Y",
        "%b %d", "%B %d",
    ]
    def try_parse(s):
        s = s.strip().rstrip(",")
        for fmt in formats:
            try:
                d = datetime.strptime(s, fmt)
                if d.year == 1900:
                    d = d.replace(year=datetime.now().year)
                return d.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return ""
    return (try_parse(parts[0]), try_parse(parts[1]))


def _normalize_status(s: str) -> str:
    s = s.lower().strip()
    if "confirm" in s or "accept" in s or "upcoming" in s:
        return "confirmed"
    if "pend" in s or "request" in s:
        return "pending"
    if "cancel" in s or "declined" in s:
        return "cancelled"
    if "complet" in s or "past" in s or "checked out" in s:
        return "completed"
    return "confirmed"


@app.post("/scrape-reservations")
async def api_scrape_reservations(req: ScrapeRequest):
    try:
        browser, context, page = await _launch_stealth_browser(req.storage_state)
        try:
            if req.platform == "vrbo":
                result = await scrape_vrbo_reservations(page, start_url=req.start_url)
            elif req.platform == "airbnb":
                result = await scrape_airbnb_reservations(page)
            elif req.platform == "booking":
                result = await scrape_booking_reservations(page)
            else:
                result = {"reservations": [], "listings": []}

            try:
                await page.screenshot(path=str(DATA_DIR / f"last_scrape_{req.platform}.png"))
            except Exception:
                pass

            return {
                "status": "ok",
                "platform": req.platform,
                "reservations": result.get("reservations", []),
                "listings": result.get("listings", []),
                "final_url": page.url,
                "debug_page_text": result.get("debug_page_text", ""),
                "debug_urls_visited": result.get("debug_urls_visited", []),
            }
        finally:
            await browser.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/debug-files/{filename}")
async def get_debug_file(filename: str):
    import base64
    filepath = DATA_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    content = filepath.read_bytes()
    if filename.endswith(".png") or filename.endswith(".jpg"):
        return {"filename": filename, "size": len(content), "content_b64": base64.b64encode(content).decode()}
    else:
        return {"filename": filename, "size": len(content), "content": content.decode("utf-8", errors="replace")[:10000]}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "sessions": {sid: {"platform": s["platform"], "tenant": s["tenant_id"]} for sid, s in sessions.items()},
        "session_count": len(sessions),
        "proxy_configured": bool(PROXY_SERVER),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
