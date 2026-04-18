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
# Sign up at Bright Data, IPRoyal, SmartProxy, etc. and set this env var
PROXY_SERVER = os.environ.get("PROXY_SERVER", "")
PROXY_USERNAME = os.environ.get("PROXY_USERNAME", "")
PROXY_PASSWORD = os.environ.get("PROXY_PASSWORD", "")

# VNC port range — each session gets its own Xvfb display + websockify port
VNC_PORT_START = int(os.environ.get("VNC_PORT_START", "6080"))
VNC_PORT_MAX = int(os.environ.get("VNC_PORT_MAX", "6099"))

# Platform start URLs
# For VRBO we use the homepage so the browser gets redirected to the correct
# locale (e.g. /en-ca/ for Canadian accounts) rather than landing on a locale
# mismatch that triggers VRBO's error page.
PLATFORM_URLS = {
    "airbnb": "https://www.airbnb.com/login",
    "vrbo": "https://www.vrbo.com",
    "booking": "https://account.booking.com/sign-in",
}

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
sessions: dict[str, dict] = {}
_next_display = 10  # Xvfb display number counter
_next_vnc_port = VNC_PORT_START
_playwright = None


# ---------------------------------------------------------------------------
# Stealth patches (comprehensive — works without playwright-extra)
# ---------------------------------------------------------------------------
STEALTH_JS = """
// Remove webdriver flag
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// Chrome runtime
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

// Plugins — make it look like a real browser
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

// Languages
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'language', { get: () => 'en-US' });

// Platform
Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });

// Hardware concurrency
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

// Device memory
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

// Connection
Object.defineProperty(navigator, 'connection', {
  get: () => ({
    effectiveType: '4g',
    rtt: 50,
    downlink: 10,
    saveData: false,
  }),
});

// Permissions — make Notification.permission look normal
const originalQuery = window.Notification && Notification.permission;
if (originalQuery) {
  const originalQueryFn = window.Notification.requestPermission;
  window.Notification.requestPermission = function() {
    return Promise.resolve(originalQuery);
  };
}

// WebGL vendor/renderer
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) return 'Intel Inc.';
  if (parameter === 37446) return 'Intel Iris OpenGL Engine';
  return getParameter.call(this, parameter);
};

// Canvas fingerprint noise
const toBlob = HTMLCanvasElement.prototype.toBlob;
const toDataURL = HTMLCanvasElement.prototype.toDataURL;
const getImageData = CanvasRenderingContext2D.prototype.getImageData;

HTMLCanvasElement.prototype.toBlob = function(...args) {
  // Add subtle noise
  const context = this.getContext('2d');
  if (context) {
    const style = context.fillStyle;
    context.fillStyle = 'rgba(0,0,0,0.01)';
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = style;
  }
  return toBlob.apply(this, args);
};

HTMLCanvasElement.prototype.toDataURL = function(...args) {
  const context = this.getContext('2d');
  if (context) {
    const style = context.fillStyle;
    context.fillStyle = 'rgba(0,0,0,0.01)';
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = style;
  }
  return toDataURL.apply(this, args);
};

// Remove Playwright-specific properties
delete window.__playwright;
delete window.__pw_manual;
delete window.__PW_inspect;

// Fix iframe contentWindow
try {
  const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get: function() {
      const result = originalContentWindow.get.call(this);
      if (result) {
        try {
          Object.defineProperty(result.navigator, 'webdriver', { get: () => undefined });
        } catch (e) {}
      }
      return result;
    },
  });
} catch (e) {}
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _alloc_display_and_port() -> tuple[int, int]:
    """Allocate next available Xvfb display number and websockify port."""
    global _next_display, _next_vnc_port
    display = _next_display
    port = _next_vnc_port
    _next_display += 1
    _next_vnc_port += 1
    if _next_vnc_port > VNC_PORT_MAX:
        _next_vnc_port = VNC_PORT_START
    return display, port


def _start_xvfb(display: int, width=1280, height=900, depth=24) -> subprocess.Popen:
    """Start an Xvfb virtual display."""
    proc = subprocess.Popen(
        ["Xvfb", f":{display}", "-screen", "0", f"{width}x{height}x{depth}", "-ac", "-nolisten", "tcp"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return proc


def _start_websockify(vnc_port: int, display: int) -> subprocess.Popen:
    """Start websockify to bridge WebSocket (noVNC) to the X display via x11vnc."""
    # First start x11vnc on the display
    vnc_display_port = 5900 + display
    x11vnc = subprocess.Popen(
        ["x11vnc", "-display", f":{display}", "-rfbport", str(vnc_display_port),
         "-nopw", "-forever", "-shared", "-noxrecord", "-noxfixes", "-noxdamage"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Then websockify connects noVNC (WebSocket) to x11vnc (RFB)
    websockify = subprocess.Popen(
        ["websockify", "--web", "/usr/share/novnc",
         str(vnc_port), f"localhost:{vnc_display_port}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return x11vnc, websockify


async def _apply_stealth(page):
    """Apply comprehensive stealth patches to a page."""
    # Try playwright-extra stealth first (better coverage)
    try:
        from playwright_stealth import stealth_async
        await stealth_async(page)
        return
    except ImportError:
        pass

    # Fall back to manual stealth JS
    await page.add_init_script(STEALTH_JS)


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------
async def create_session(tenant_id: str, platform: str) -> dict:
    """Create a new live browser session with stealth + proxy."""
    global _playwright

    from playwright.async_api import async_playwright

    if not _playwright:
        _playwright = await async_playwright().start()

    session_id = str(uuid.uuid4())[:8]
    display, vnc_port = _alloc_display_and_port()

    # Start virtual display
    xvfb_proc = _start_xvfb(display)
    await asyncio.sleep(0.5)  # Let Xvfb initialize

    # Start x11vnc + websockify
    x11vnc_proc, ws_proc = _start_websockify(vnc_port, display)
    await asyncio.sleep(0.5)

    # Build browser launch args
    browser_args = [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--disable-translate",
        "--metrics-recording-only",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        f"--display=:{display}",
    ]

    # Build proxy config if available
    proxy_config = None
    if PROXY_SERVER:
        proxy_config = {"server": PROXY_SERVER}
        if PROXY_USERNAME:
            proxy_config["username"] = PROXY_USERNAME
            proxy_config["password"] = PROXY_PASSWORD

    # Launch HEADED browser on the Xvfb display
    # Use real Google Chrome instead of Playwright's Chromium for authentic
    # TLS fingerprint (JA3/JA4) — critical for bypassing PerimeterX/HUMAN
    launch_kwargs = {
        "headless": False,  # Headed so it renders on Xvfb → noVNC
        "channel": "chrome",  # Use system-installed Google Chrome
        "args": browser_args,
    }
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

    try:
        browser = await _playwright.chromium.launch(**launch_kwargs)
    except Exception as e:
        # Fall back to Playwright Chromium if Chrome not installed
        print(f"Chrome launch failed ({e}), falling back to Chromium")
        del launch_kwargs["channel"]
        browser = await _playwright.chromium.launch(**launch_kwargs)

    # Create context with realistic fingerprint
    context_kwargs = {
        "user_agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/147.0.0.0 Safari/537.36"
        ),
        "viewport": {"width": 1280, "height": 900},
        "locale": "en-US",
        "timezone_id": "America/Los_Angeles",
        "color_scheme": "light",
        "has_touch": False,
        "is_mobile": False,
        "java_script_enabled": True,
        "permissions": ["geolocation"],
        "geolocation": {"latitude": 34.0522, "longitude": -118.2437},  # LA
    }

    context = await browser.new_context(**context_kwargs)

    # Apply stealth before any navigation
    page = await context.new_page()
    await _apply_stealth(page)

    # Navigate to platform login
    start_url = PLATFORM_URLS.get(platform, PLATFORM_URLS["airbnb"])
    try:
        await page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        print(f"[{session_id}] Warning: initial navigation error (may be fine): {e}")

    # Store session info
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

    print(f"[{session_id}] Session created: platform={platform}, display=:{display}, vnc_port={vnc_port}, proxy={'YES' if proxy_config else 'NO'}")
    return {"session_id": session_id, "ws_port": vnc_port}


async def finish_session(session_id: str) -> dict:
    """Capture cookies/storage from the session, then tear it down."""
    s = sessions.get(session_id)
    if not s:
        raise ValueError(f"Session {session_id} not found")

    # Capture storage state (cookies + localStorage)
    storage_state = None
    cookie_count = 0
    final_url = ""
    try:
        final_url = s["page"].url
        storage_state = await s["context"].storage_state()
        cookie_count = len(storage_state.get("cookies", []))
    except Exception as e:
        print(f"[{session_id}] Error capturing state: {e}")

    platform = s["platform"]

    # Tear down
    try:
        await s["browser"].close()
    except Exception:
        pass

    # Kill subprocesses
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
    print(f"Live Session Service starting on port {PORT}")
    if PROXY_SERVER:
        print(f"  Residential proxy: {PROXY_SERVER.split('@')[-1] if '@' in PROXY_SERVER else PROXY_SERVER}")
    else:
        print("  WARNING: No residential proxy configured. Set PROXY_SERVER env var.")
        print("  Bot detection WILL block datacenter IPs on VRBO/Airbnb.")
    yield
    # Cleanup all sessions on shutdown
    for sid in list(sessions.keys()):
        try:
            await finish_session(sid)
        except Exception:
            pass

app = FastAPI(title="Host4Me Live Sessions", version="2.0.0", lifespan=lifespan)


class CreateSessionRequest(BaseModel):
    tenant_id: str
    platform: str  # "airbnb" | "vrbo" | "booking"


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
    storage_state: str          # JSON string of cookies/localStorage from Convex
    platform: str               # "vrbo" | "airbnb" | "booking"
    start_url: str | None = None  # finalUrl stored at login — used to infer correct locale


async def scrape_vrbo_listings(context, page) -> list[dict]:
    """Navigate VRBO dashboard and extract property listings."""
    listings = []

    # Navigate to VRBO property listing page
    try:
        await page.goto("https://www.vrbo.com/", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        # Check if we're logged in by looking for host dashboard indicators
        current_url = page.url
        print(f"[scrape] After VRBO home, URL: {current_url}")

        # Try to navigate to the owner/host dashboard
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

        # Check if we got redirected to login
        if "/login" in page.url or "/auth" in page.url:
            print("[scrape] Session expired — redirected to login")
            return []

        # Extract listings from the page
        # Try multiple selectors for different VRBO dashboard layouts
        await page.wait_for_timeout(2000)

        # Method 1: Try to get listing data from the page content
        page_content = await page.content()

        # Method 2: Try extracting from DOM elements
        listing_elements = await page.query_selector_all('[data-testid*="property"], [class*="property-card"], [class*="listing"], .property-item, [data-stid*="property"]')

        if listing_elements:
            for el in listing_elements[:20]:  # Cap at 20
                try:
                    name = await el.query_selector('[class*="name"], [class*="title"], h2, h3')
                    name_text = await name.inner_text() if name else "Unknown Property"

                    location = await el.query_selector('[class*="location"], [class*="address"]')
                    location_text = await location.inner_text() if location else ""

                    listings.append({
                        "name": name_text.strip(),
                        "location": location_text.strip(),
                        "platform": "vrbo",
                    })
                except Exception as e:
                    print(f"[scrape] Error extracting listing element: {e}")
                    continue

        # Method 3: If no elements found, try Gemini-style extraction from page text
        if not listings:
            # Get all visible text and try to parse property info
            try:
                all_text = await page.inner_text("body")
                # Look for property-like patterns in the text
                # This is a fallback — the DOM extraction above is preferred
                print(f"[scrape] No listing elements found. Page text length: {len(all_text)}")
                print(f"[scrape] Page URL: {page.url}")
                print(f"[scrape] First 500 chars: {all_text[:500]}")
            except Exception:
                pass

        # Method 4: Try VRBO API endpoint that the dashboard calls
        if not listings:
            try:
                # VRBO's host dashboard often loads data from an API
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
    """Launch a headless browser with saved cookies and scrape listings."""
    global _playwright
    from playwright.async_api import async_playwright

    if not _playwright:
        _playwright = await async_playwright().start()

    # Parse storage state
    try:
        storage_state = json.loads(storage_state_json)
    except json.JSONDecodeError as e:
        return {"status": "error", "message": f"Invalid storage state JSON: {e}", "listings": []}

    # Build browser launch args
    browser_args = [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--disable-dev-shm-usage",
    ]

    proxy_config = None
    if PROXY_SERVER:
        proxy_config = {"server": PROXY_SERVER}
        if PROXY_USERNAME:
            proxy_config["username"] = PROXY_USERNAME
            proxy_config["password"] = PROXY_PASSWORD

    launch_kwargs = {
        "headless": True,
        "args": browser_args,
    }
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

    browser = await _playwright.chromium.launch(**launch_kwargs)

    try:
        # Create context with saved cookies
        context = await browser.new_context(
            storage_state=storage_state,
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/147.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="en-US",
            timezone_id="America/Los_Angeles",
        )

        page = await context.new_page()

        # Apply stealth
        try:
            from playwright_stealth import stealth_async as _stealth
            await _stealth(page)
        except ImportError:
            await page.add_init_script(STEALTH_JS)

        # Scrape based on platform
        if platform == "vrbo":
            listings = await scrape_vrbo_listings(context, page)
        else:
            # TODO: Add airbnb/booking scrapers
            listings = []

        # Take a screenshot for debugging
        screenshot_path = DATA_DIR / "last_scrape.png"
        try:
            await page.screenshot(path=str(screenshot_path))
        except Exception:
            pass

        return {
            "status": "ok",
            "platform": platform,
            "listings": listings,
            "count": len(listings),
            "final_url": page.url,
        }

    finally:
        await browser.close()


@app.post("/scrape-listings")
async def api_scrape_listings(req: ScrapeRequest):
    """Scrape property listings using saved session cookies."""
    try:
        result = await scrape_listings_with_cookies(req.storage_state, req.platform)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Scrape RESERVATIONS using saved session cookies (all platforms)
# ---------------------------------------------------------------------------

async def _launch_stealth_browser(storage_state_json: str):
    """Shared helper: launch a headless stealth browser with saved cookies."""
    global _playwright
    from playwright.async_api import async_playwright
    if not _playwright:
        _playwright = await async_playwright().start()

    storage_state = json.loads(storage_state_json)
    browser_args = [
        "--no-sandbox", "--disable-blink-features=AutomationControlled",
        "--disable-infobars", "--disable-dev-shm-usage",
    ]
    proxy_config = None
    if PROXY_SERVER:
        proxy_config = {"server": PROXY_SERVER}
        if PROXY_USERNAME:
            proxy_config["username"] = PROXY_USERNAME
            proxy_config["password"] = PROXY_PASSWORD

    launch_kwargs = {"headless": True, "args": browser_args}
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

    browser = await _playwright.chromium.launch(**launch_kwargs)
    context = await browser.new_context(
        storage_state=storage_state,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 900},
        locale="en-US",
        timezone_id="America/Los_Angeles",
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

    VRBO is a React SPA — DOM scraping is unreliable because class names are hashed
    and data loads asynchronously via internal GraphQL / REST APIs.  Instead we:
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
    captured_api_responses = []  # raw JSON blobs intercepted from network

    # ── 1. Wire up network interception BEFORE any navigation ──────────────────
    async def handle_response(response):
        url = response.url
        # Capture any JSON that looks like it could contain reservation or property data
        keywords = (
            "reservation", "booking", "listing", "property", "graphql",
            "host/api", "traveler", "accommodation", "stay", "unit"
        )
        if not any(k in url.lower() for k in keywords):
            return
        try:
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            status = response.status
            if status < 200 or status >= 400:
                return
            body = await response.json()
            captured_api_responses.append({"url": url, "body": body})
            print(f"[vrbo-net] Captured {url} ({type(body).__name__}, status={status})")
        except Exception as capture_err:
            print(f"[vrbo-net] Could not capture {url}: {capture_err}")

    page.on("response", handle_response)

    try:
        # ── 2. Build reservation URL list ─────────────────────────────────────
        # If we have the URL the user landed on after logging in, extract the
        # locale prefix (e.g. /en-ca/) and build locale-specific URLs first.
        def _locale_urls(path_suffix: str) -> list[str]:
            """Return URLs with locale-aware prefix inferred from start_url first."""
            urls = []
            if start_url:
                from urllib.parse import urlparse
                parsed = urlparse(start_url)
                base = f"{parsed.scheme}://{parsed.netloc}"
                # Extract locale prefix like /en-ca, /en-us from the stored URL path
                import re
                m = re.match(r"^/(en-[a-z]{2})/", parsed.path)
                locale_prefix = m.group(1) if m else None
                if locale_prefix:
                    urls.append(f"{base}/{locale_prefix}{path_suffix}")
                    urls.append(f"{base}/{locale_prefix}/p{path_suffix}")
                # Also try base without locale prefix
                urls.append(f"{base}{path_suffix}")
            # Generic fallbacks (owner.vrbo.com removed — fails via SOCKS tunnel)
            urls += [
                "https://www.vrbo.com/en-ca/host/reservations",
                "https://www.vrbo.com/en-ca/p/reservations",
                "https://www.vrbo.com/en-us/host/reservations",
                "https://www.vrbo.com/host/reservations",
            ]
            # Deduplicate while preserving order
            seen = set()
            return [u for u in urls if not (u in seen or seen.add(u))]

        reservation_urls = _locale_urls("/host/reservations")
        landed_url = ""
        NOT_FOUND_SIGNALS = [
            "page cannot be found", "page not found", "404",
            "doesn't exist", "no longer available",
        ]
        for url in reservation_urls:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(5000)
                landed_url = page.url
                # Check for login redirect
                if "/login" in landed_url or "/auth" in landed_url:
                    debug_urls_visited.append({"attempted": url, "landed": landed_url, "error": "login redirect"})
                    continue
                # Check for 404 / page-not-found in page text
                try:
                    body_text = (await page.inner_text("body")).lower()
                    if any(sig in body_text for sig in NOT_FOUND_SIGNALS):
                        debug_urls_visited.append({"attempted": url, "landed": landed_url, "error": "page not found"})
                        print(f"[vrbo-res] 404 at {url}, trying next...")
                        continue
                except Exception:
                    pass
                debug_urls_visited.append({"attempted": url, "landed": landed_url})
                print(f"[vrbo-res] Landed at: {landed_url}")
                break
            except Exception as nav_err:
                debug_urls_visited.append({"attempted": url, "error": str(nav_err)})
                continue

        if "/login" in page.url or "/auth" in page.url:
            print("[vrbo-res] Session expired — redirected to login")
            return {
                "reservations": [],
                "listings": [],
                "debug_page_text": "SESSION EXPIRED",
                "debug_urls_visited": debug_urls_visited,
            }

        # Extra wait to catch lazy-loaded XHR
        await page.wait_for_timeout(4000)

        # Save debug screenshot
        try:
            await page.screenshot(path=str(DATA_DIR / "vrbo_reservations_debug.png"), full_page=True)
        except Exception:
            pass

        # ── 3. Parse captured network responses ───────────────────────────────
        def _extract_from_blob(blob):
            """Recursively walk a JSON blob looking for reservation-like objects."""
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
                    # Reservation detection: has a guest name + date fields
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
                        # Extract best-effort fields
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
                            return  # don't descend into reservation objects

                    # Listing detection: has a name + location/address without guest names
                    has_listing_name = any(k in keys_lower for k in (
                        "headline", "propertyname", "listingname", "unitname", "propertytitle",
                    ))
                    has_listing_loc = any(k in keys_lower for k in (
                        "city", "location", "address", "latitude", "longitude",
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

                    # Recurse into all values
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

        # ── 4. If network capture missed everything, fire explicit API fetches ──
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

        # ── 5. Also navigate to properties page for listings ──────────────────
        if not listings:
            listing_urls = _locale_urls("/host/properties")
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

            # Re-parse whatever new network responses came in
            for capture in captured_api_responses:
                blob = capture["body"]
                _, list_found = _extract_from_blob(blob)
                for l in list_found:
                    if l["name"] not in seen_listing_names:
                        seen_listing_names.add(l["name"])
                        listings.append(l)

        # ── 6. Page-text fallback for debug / partial extraction ───────────────
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
        # Clean up listener to avoid memory leaks
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
    """Scrape reservations + listings from Airbnb host dashboard."""
    reservations = []
    listings = []

    try:
        # Navigate to Airbnb hosting reservations
        await page.goto("https://www.airbnb.com/hosting/reservations", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        if "/login" in page.url:
            print("[airbnb-res] Session expired")
            return {"reservations": [], "listings": []}

        print(f"[airbnb-res] At: {page.url}")

        # Extract from DOM
        res_elements = await page.query_selector_all(
            '[data-testid*="reservation"], [class*="reservation-card"], '
            'table tbody tr, [class*="trip"]'
        )

        for el in res_elements[:50]:
            try:
                text = await el.inner_text()
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                # Airbnb typically shows: guest name, dates, property, status
                if len(lines) >= 2:
                    guest = lines[0]
                    dates_str = next((l for l in lines if any(m in l.lower() for m in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])), "")
                    check_in, check_out = _parse_date_range(dates_str)
                    prop = next((l for l in lines[1:] if l and l != guest and l != dates_str), "")
                    status = next((l for l in lines if l.lower() in ["confirmed", "pending", "cancelled", "completed", "upcoming"]), "confirmed")

                    if guest:
                        reservations.append({
                            "guestName": guest,
                            "checkIn": check_in,
                            "checkOut": check_out,
                            "propertyName": prop,
                            "status": _normalize_status(status),
                        })
            except Exception as e:
                print(f"[airbnb-res] Parse error: {e}")

        # Grab listings too
        try:
            await page.goto("https://www.airbnb.com/hosting/listings", wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
            listing_els = await page.query_selector_all('[class*="listing"], [data-testid*="listing"]')
            for el in listing_els[:20]:
                try:
                    name_el = await el.query_selector('[class*="title"], [class*="name"], h2, h3')
                    name = await name_el.inner_text() if name_el else ""
                    if name.strip():
                        listings.append({"name": name.strip(), "platform": "airbnb", "location": ""})
                except Exception:
                    pass
        except Exception:
            pass

    except Exception as e:
        print(f"[airbnb-res] Error: {e}")

    return {"reservations": reservations, "listings": listings}


async def scrape_booking_reservations(page) -> dict:
    """Scrape reservations + listings from Booking.com extranet."""
    reservations = []
    listings = []

    try:
        # Booking.com host dashboard is at extranet
        await page.goto("https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking_reservations.html", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        if "sign-in" in page.url or "login" in page.url:
            print("[booking-res] Session expired")
            return {"reservations": [], "listings": []}

        print(f"[booking-res] At: {page.url}")

        # Extract reservations from the table
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
    """Try to parse a date range string into ISO dates. Returns ('', '') on failure."""
    import re
    from datetime import datetime

    if not text:
        return ("", "")

    # Try "Apr 20 - Apr 25, 2025" or "04/20/2025 - 04/25/2025" etc.
    # Common separators: -, –, —, to
    parts = re.split(r'\s*[-–—]\s*|\s+to\s+', text, maxsplit=1)
    if len(parts) != 2:
        return ("", "")

    formats = [
        "%b %d, %Y", "%b %d %Y", "%B %d, %Y", "%B %d %Y",
        "%m/%d/%Y", "%Y-%m-%d", "%d %b %Y", "%d %B %Y",
        "%b %d", "%B %d",  # no year — assume current
    ]

    def try_parse(s):
        s = s.strip().rstrip(",")
        for fmt in formats:
            try:
                d = datetime.strptime(s, fmt)
                if d.year == 1900:  # no year parsed
                    d = d.replace(year=datetime.now().year)
                return d.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return ""

    return (try_parse(parts[0]), try_parse(parts[1]))


def _normalize_status(s: str) -> str:
    """Normalize reservation status to one of our standard values."""
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
    """Scrape reservations + listings using saved session cookies."""
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

            # Screenshot for debugging
            debug_screenshot_b64 = None
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
    """Serve debug files (screenshots, HTML) from data dir."""
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
