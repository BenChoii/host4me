/**
 * Bridge to the persistent Python browser agent.
 * Calls HTTP endpoints on the vision-based agent loop.
 */

const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8100';

async function runBrowserAgent(action, pmId, ...args) {
  const endpoints = {
    login: { path: '/login', body: { pmId, email: args[0], password: args[1], platform: args[2] || 'airbnb' } },
    inbox: { path: '/inbox', body: { pmId, platform: args[0] || 'airbnb' } },
    '2fa': { path: '/2fa', body: { pmId, code: args[0] } },
    screenshot: { path: '/screenshot', body: { pmId, prompt: args[0] } },
    navigate: { path: '/navigate', body: { pmId, url: args[0] } },
    action: { path: '/action', body: { pmId, action: args[0] } },
    goal: { path: '/goal', body: { pmId, goal: args[0], maxSteps: args[1] || 10, startUrl: args[2] || '' } },
  };

  const ep = endpoints[action];
  if (!ep) return { status: 'error', message: `Unknown action: ${action}` };

  console.log(`[BrowserAgent] ${action} for PM ${pmId}`);

  try {
    const resp = await fetch(`${BROWSER_SERVICE_URL}${ep.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ep.body),
    });
    const result = await resp.json();
    console.log(`[BrowserAgent] Result: ${JSON.stringify(result).slice(0, 500)}`);
    return result;
  } catch (err) {
    console.error(`[BrowserAgent] Error: ${err.message}`);
    return { status: 'error', message: `Browser agent unavailable: ${err.message}` };
  }
}

module.exports = { runBrowserAgent };
