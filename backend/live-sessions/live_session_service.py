""" 
Host4Me Live Browser Session Service (Port 8101)

Launches headed Playwright browsers with Xvfb + noVNC so users can
log into Airbnb/VRBO through an embedded browser in the dashboard.

Anti-bot measures:
  1. Residential proxy (PROXY_SERVER env var) — routes browser traffic
     through real residential IPs so PerimeterX/HUMAN doesn't flag datacenter IP
  2. Playwright stealth — patches navigator.webdriver, chrome runtime, plugins,
     languages, WebGL, and other automation fingerprints
  3. Realistic browser args — removes automation banners, disables blink
     automation detection
  4. Human-like viewport, user agent, timezone, locale

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
    launch_kwargs = {
        "headless": False,  # Headed so it renders on Xvfb -> noVNC
        "args": browser_args,
    }
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

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
        "geolocation": {"latitude": 34.0522, "longitude": -118.2437},
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
