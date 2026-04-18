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
PLATFORM_URLS = {
    "airbnb": "https://www.airbnb.com/login",
    "vrbo": "https://www.vrbo.com/login",
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
            "Chrome/131.0.0.0 Safari/537.36"
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
    storage_state: str  # JSON string of cookies/localStorage from Convex
    platform: str       # "vrbo" | "airbnb" | "booking"


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
            "https://www.vrbo.com/en-us/host/properties",
            "https://www.vrbo.com/host/properties",
            "https://owner.vrbo.com/properties",
            "https://www.vrbo.com/en-us/host/dashboard",
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
                "Chrome/131.0.0.0 Safari/537.36"
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
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
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


async def scrape_vrbo_reservations(page) -> dict:
    """Scrape reservations + listings from VRBO host dashboard."""
    reservations = []
    listings = []
    debug_page_text = ""
    debug_urls_visited = []

    try:
        # Navigate to VRBO host reservations page
        for url in [
            "https://www.vrbo.com/en-us/host/reservations",
            "https://www.vrbo.com/host/reservations",
            "https://owner.vrbo.com/reservations",
        ]:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(3000)
                debug_urls_visited.append({"attempted": url, "landed": page.url})
                if "/login" not in page.url and "/auth" not in page.url:
                    print(f"[vrbo-res] Found reservations at: {page.url}")
                    break
            except Exception as nav_err:
                debug_urls_visited.append({"attempted": url, "error": str(nav_err)})
                continue

        if "/login" in page.url or "/auth" in page.url:
            print("[vrbo-res] Session expired")
            return {"reservations": [], "listings": [], "debug_page_text": "SESSION EXPIRED - redirected to login", "debug_urls_visited": debug_urls_visited}

        # Save debug screenshot
        try:
            await page.screenshot(path=str(DATA_DIR / "vrbo_reservations_debug.png"), full_page=True)
            print(f"[vrbo-res] Debug screenshot saved to {DATA_DIR}/vrbo_reservations_debug.png")
        except Exception as e:
            print(f"[vrbo-res] Screenshot failed: {e}")

        # Save page HTML for debugging
        try:
            html = await page.content()
            with open(str(DATA_DIR / "vrbo_reservations_debug.html"), "w") as f:
                f.write(html)
            print(f"[vrbo-res] Page HTML saved ({len(html)} chars)")
        except Exception as e:
            print(f"[vrbo-res] HTML save failed: {e}")

        # Extract reservation data from DOM — try multiple selector strategies
        await page.wait_for_timeout(2000)

        # Strategy 1: specific VRBO selectors
        res_elements = await page.query_selector_all(
            '[data-testid*="reservation"], [class*="reservation"], '
            'tr[class*="booking"], [class*="trip-card"], [data-stid*="reservation"]'
        )
        print(f"[vrbo-res] Strategy 1 found {len(res_elements)} elements")

        # Strategy 2: table rows
        if not res_elements:
            res_elements = await page.query_selector_all('table tbody tr')
            print(f"[vrbo-res] Strategy 2 (table rows) found {len(res_elements)} elements")

        # Strategy 3: any card/list-item-like elements
        if not res_elements:
            res_elements = await page.query_selector_all(
                '[class*="card"], [class*="list-item"], [class*="row"][class*="book"], '
                '[role="row"], [class*="Reservation"], [class*="booking"]'
            )
            print(f"[vrbo-res] Strategy 3 (generic cards) found {len(res_elements)} elements")

        for el in res_elements[:50]:
            try:
                guest_el = await el.query_selector('[class*="guest"], [class*="name"], [class*="traveler"]')
                dates_el = await el.query_selector('[class*="date"], [class*="check"]')
                prop_el = await el.query_selector('[class*="property"], [class*="listing"]')
                status_el = await el.query_selector('[class*="status"], [class*="badge"]')

                guest = await guest_el.inner_text() if guest_el else ""
                dates = await dates_el.inner_text() if dates_el else ""
                prop = await prop_el.inner_text() if prop_el else ""
                status = await status_el.inner_text() if status_el else "confirmed"

                # Parse dates — try common formats
                check_in, check_out = _parse_date_range(dates)

                if guest.strip():
                    reservations.append({
                        "guestName": guest.strip(),
                        "checkIn": check_in,
                        "checkOut": check_out,
                        "propertyName": prop.strip(),
                        "status": _normalize_status(status.strip()),
                    })
            except Exception as e:
                print(f"[vrbo-res] Error parsing element: {e}")

        # Fallback: try to extract from page JavaScript/API
        if not reservations:
            try:
                api_data = await page.evaluate("""
                    async () => {
                        const urls = ['/api/host/reservations', '/en-us/host/api/reservations'];
                        for (const url of urls) {
                            try {
                                const r = await fetch(url, { credentials: 'include' });
                                if (r.ok) return await r.json();
                            } catch(e) {}
                        }
                        return null;
                    }
                """)
                if api_data:
                    items = api_data if isinstance(api_data, list) else api_data.get("reservations", api_data.get("items", []))
                    for item in items:
                        reservations.append({
                            "guestName": item.get("guestName", item.get("travelerName", "Unknown")),
                            "checkIn": item.get("checkIn", item.get("arrivalDate", "")),
                            "checkOut": item.get("checkOut", item.get("departureDate", "")),
                            "propertyName": item.get("propertyName", item.get("listingName", "")),
                            "status": _normalize_status(item.get("status", "confirmed")),
                            "guests": item.get("guestCount", item.get("numberOfGuests")),
                            "payout": item.get("payout", item.get("totalPayout")),
                            "reservationId": item.get("reservationId", item.get("id")),
                        })
            except Exception as e:
                print(f"[vrbo-res] API fallback failed: {e}")

        # Fallback 2: extract all visible text and parse for reservation-like patterns
        if not reservations:
            try:
                all_text = await page.inner_text("body")
                debug_page_text = all_text[:2000]
                print(f"[vrbo-res] Full page text ({len(all_text)} chars): {all_text[:500]}")
            except Exception as e:
                print(f"[vrbo-res] Text extraction failed: {e}")
        else:
            debug_page_text = f"Found {len(reservations)} reservations"

        print(f"[vrbo-res] Final: {len(reservations)} reservations found")

        # Also grab listings
        try:
            for url in ["https://www.vrbo.com/en-us/host/properties", "https://www.vrbo.com/host/properties"]:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    await page.wait_for_timeout(2000)
                    if "/login" not in page.url:
                        break
                except Exception:
                    continue

            prop_elements = await page.query_selector_all(
                '[data-testid*="property"], [class*="property-card"], [class*="listing"]'
            )
            for el in prop_elements[:20]:
                try:
                    name_el = await el.query_selector('[class*="name"], [class*="title"], h2, h3')
                    loc_el = await el.query_selector('[class*="location"], [class*="address"]')
                    name = await name_el.inner_text() if name_el else ""
                    loc = await loc_el.inner_text() if loc_el else ""
                    if name.strip():
                        listings.append({"name": name.strip(), "location": loc.strip(), "platform": "vrbo"})
                except Exception:
                    pass
        except Exception:
            pass

    except Exception as e:
        print(f"[vrbo-res] Error: {e}")
        debug_page_text = f"ERROR: {e}"

    return {"reservations": reservations, "listings": listings, "debug_page_text": debug_page_text, "debug_urls_visited": debug_urls_visited}


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
                result = await scrape_vrbo_reservations(page)
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
