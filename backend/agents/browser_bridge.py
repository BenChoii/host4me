"""
Bridge between ADK runner and the browser agent (Playwright + Gemma 4 vision).

Calls the browser_agent.py script as a subprocess, same as run-agent.js did.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

PYTHON_PATH = sys.executable
AGENT_SCRIPT = str(Path(__file__).parent.parent / "browser" / "browser_agent.py")
TIMEOUT = 120  # seconds


async def run_browser_agent(action: str, tenant_id: str, *args) -> dict:
    """Run the browser agent as a subprocess and return the JSON result."""
    cmd = [PYTHON_PATH, AGENT_SCRIPT, action, tenant_id, *args]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                **os.environ,
                "OPENROUTER_API_KEY": os.environ.get("OPENROUTER_API_KEY", ""),
                "HOST4ME_DATA_DIR": os.environ.get("HOST4ME_DATA_DIR", "/opt/host4me/data"),
            },
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=TIMEOUT,
        )

        if stderr:
            print(f"[BrowserAgent] stderr: {stderr.decode()[:500]}", file=sys.stderr)

        if proc.returncode != 0:
            return {"status": "error", "message": f"Process exited with code {proc.returncode}"}

        return json.loads(stdout.decode().strip())

    except asyncio.TimeoutError:
        return {"status": "error", "message": "Browser agent timed out"}
    except json.JSONDecodeError:
        return {"status": "error", "message": "Could not parse agent output"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
