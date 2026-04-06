/**
 * Bridge between Node.js Express server and Python browser-use agent.
 * Calls the Python script via subprocess and returns JSON results.
 */

const { execFile } = require('child_process');
const path = require('path');

const PYTHON_PATH = process.env.PYTHON_PATH || 'python3';
const AGENT_SCRIPT = path.join(__dirname, 'browser_agent.py');
const TIMEOUT = 120000; // 2 minutes max per browser action

function runBrowserAgent(action, pmId, ...args) {
  return new Promise((resolve, reject) => {
    const cmdArgs = [AGENT_SCRIPT, action, pmId, ...args];

    console.log(`[BrowserAgent] Running: ${action} for PM ${pmId}`);

    execFile(PYTHON_PATH, cmdArgs, {
      timeout: TIMEOUT,
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        HOST4ME_DATA_DIR: process.env.HOST4ME_DATA_DIR || '/opt/host4me/data',
      },
    }, (error, stdout, stderr) => {
      if (stderr) console.log(`[BrowserAgent] stderr: ${stderr.slice(0, 500)}`);

      if (error) {
        console.error(`[BrowserAgent] Error: ${error.message}`);
        resolve({ status: 'error', message: error.message });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        console.log(`[BrowserAgent] Result: ${JSON.stringify(result).slice(0, 300)}`);
        resolve(result);
      } catch {
        console.log(`[BrowserAgent] Raw output: ${stdout.slice(0, 500)}`);
        resolve({ status: 'error', message: 'Could not parse agent output', raw: stdout.slice(0, 500) });
      }
    });
  });
}

module.exports = { runBrowserAgent };
