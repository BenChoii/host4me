require('dotenv').config();

/**
 * Host4Me Backend Server
 *
 * Express server tying together:
 * - Telegram bot webhooks (PM communication)
 * - ADK Agent Runner (replaces Paperclip)
 * - Browser agent API proxy
 * - Onboarding endpoints
 * - Health monitoring
 */

const express = require('express');
const path = require('path');
const { BotManager } = require('./telegram/bot-manager');
const { validateInitData } = require('./telegram/mini-app/validate');
const { formatSessionExpired } = require('./telegram/notifications');
const { encryptCredentials } = require('./onboarding/credential-vault');
const { analyzeStyle, generateStyleGuide, STYLE_PRESETS } = require('./onboarding/style-learner');
const ollamaConfig = require('./config/ollama');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BROWSER_AGENT_URL = process.env.BROWSER_AGENT_URL || 'http://localhost:8100';
const ADK_RUNNER_URL = process.env.ADK_RUNNER_URL || 'http://localhost:3200';
const POLL_INTERVAL = parseInt(process.env.BROWSER_POLL_INTERVAL_MS || '180000', 10);

// ==========================================================================
// Telegram Bot Manager
// ==========================================================================

const botManager = new BotManager();

// Conversation history per PM (in-memory for now, move to DB later)
const conversations = new Map();

const ALFRED_SYSTEM_PROMPT = `You are Alfred, the AI concierge for Host4Me. You manage short-term rental properties autonomously.

RULES:
- NEVER re-introduce yourself after the first message
- Be concise. 2-3 sentences max unless asked for detail
- Sound like a sharp, competent assistant — not a chatbot
- No filler phrases like "That's a great question" or "I'd be happy to help"

YOUR #1 PRIORITY is getting access to the PM's platforms so you can start working.

ONBOARDING FLOW (follow this order):
1. Ask what platform they use (Airbnb, VRBO, etc)
2. Ask for their platform login email
3. Ask for their platform password (explain it's encrypted and stored securely on their private server)
4. Once you have email + password, say "Got it. Logging into your [platform] now..." — the backend will handle the actual login
5. If 2FA is needed, ask for the verification code
6. Once logged in, check their inbox and report what you find

AFTER ONBOARDING you handle:
- Reading and replying to guest messages in the PM's voice
- Daily pricing research
- Listing optimization
- Escalation of emergencies
- Daily briefings

When the PM sends their credentials, format your response to include:
[LOGIN_REQUEST: platform=airbnb, email=their@email.com, password=theirpassword]
This tag triggers the backend to start the browser login. The PM won't see this tag.

Keep it natural. You're a business partner, not a robot.`;

// Handle PM messages — route to ADK Alfred agent
botManager.onPmMessage = async (pmId, type, data) => {
  console.log(`PM ${pmId} message: ${type}`, data);

  if (type === 'auth_code') {
    // Relay 2FA code to browser agent
    try {
      await fetch(`${BROWSER_AGENT_URL}/submit-auth-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pm_id: pmId,
          platform: data.platform,
          code: data.code,
        }),
      });
    } catch (err) {
      console.error(`Failed to submit auth code for ${pmId}:`, err.message);
    }
    return;
  }

  if (type === 'command' || type === 'text') {
    const message = type === 'command' ? `/${data.command}` : data.text;

    // Try ADK runner first, fall back to Gemini Flash API
    try {
      const adkRes = await fetch(`${ADK_RUNNER_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pm_id: pmId, message, source: 'telegram' }),
      });
      if (adkRes.ok) return;
    } catch {
      // ADK runner not available — use Gemini fallback
    }

    // Gemini Flash API with conversation history
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (GEMINI_API_KEY) {
      try {
        console.log(`[Gemini] PM ${pmId}: ${message}`);

        // Get or create conversation history
        if (!conversations.has(pmId)) conversations.set(pmId, []);
        const history = conversations.get(pmId);

        // Add user message to history
        history.push({ role: 'user', parts: [{ text: message }] });

        // Keep last 20 messages to avoid token limits
        const recentHistory = history.slice(-20);

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: recentHistory,
              systemInstruction: { parts: [{ text: ALFRED_SYSTEM_PROMPT }] },
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
              },
            }),
          }
        );
        const result = await geminiRes.json();
        const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          // Check for LOGIN_REQUEST tag and trigger browser login
          const loginMatch = reply.match(/\[LOGIN_REQUEST:\s*platform=(\w+),\s*email=([^,]+),\s*password=([^\]]+)\]/);
          let cleanReply = reply.replace(/\[LOGIN_REQUEST:[^\]]+\]/g, '').trim();

          // Add Alfred's reply to conversation history
          history.push({ role: 'model', parts: [{ text: cleanReply }] });
          await botManager.sendMessage(pmId, cleanReply);

          if (loginMatch) {
            const [, platform, email, password] = loginMatch;
            console.log(`[Browser] Login triggered for PM ${pmId} on ${platform}`);

            try {
              const browser = await getBrowser(pmId);
              let result;
              if (platform === 'airbnb') {
                result = await browser.loginAirbnb(email.trim(), password.trim());
              } else {
                result = { status: 'error', message: `${platform} not yet supported` };
              }

              if (result.status === 'logged_in' || result.status === 'already_logged_in') {
                await botManager.sendMessage(pmId, `✅ Successfully logged into ${platform}! Checking your inbox now...`);
                const inbox = await browser.checkAirbnbInbox();
                if (inbox.messages && inbox.messages.length > 0) {
                  const summary = inbox.messages.map(m => `• *${m.guest_name}*: ${m.message_preview}`).join('\n');
                  await botManager.sendMessage(pmId, `📨 Found ${inbox.count} conversation(s):\n\n${summary}`);
                } else {
                  await botManager.sendMessage(pmId, '📭 Inbox is clear — no unread messages.');
                }
              } else if (result.status === '2fa_required') {
                await botManager.sendMessage(pmId, `🔐 ${platform} is asking for a verification code. Check your email or phone and send me the code.`);
              } else {
                await botManager.sendMessage(pmId, `⚠️ Login issue: ${result.message || result.status}. Let me know if you need to try again.`);
              }
            } catch (err) {
              console.error(`[Browser] Login error for ${pmId}:`, err.message);
              await botManager.sendMessage(pmId, `⚠️ Had trouble logging in: ${err.message}`);
            }
          }

          console.log(`[Gemini] Replied to PM ${pmId}`);
        } else {
          console.error('[Gemini] No reply in response:', JSON.stringify(result).slice(0, 200));
        }
      } catch (err) {
        console.error(`[Gemini] Failed for ${pmId}:`, err.message);
        await botManager.sendMessage(pmId, "Sorry, I'm having trouble right now. Please try again in a moment.");
      }
    } else {
      // Ollama fallback if no Gemini key
      try {
        console.log(`[Ollama fallback] PM ${pmId}: ${message}`);
        const ollamaRes = await fetch(`${ollamaConfig.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaConfig.models.primary,
            messages: [
              { role: 'system', content: 'You are Alfred, an AI property management assistant. Be concise and helpful.' },
              { role: 'user', content: message },
            ],
            stream: false,
          }),
        });
        const result = await ollamaRes.json();
        const reply = result?.message?.content;
        if (reply) await botManager.sendMessage(pmId, reply);
      } catch (err) {
        console.error(`[Ollama fallback] Failed for ${pmId}:`, err.message);
      }
    }
  }
};

// Telegram webhook endpoint
app.post('/api/telegram/:pmId', async (req, res) => {
  try {
    await botManager.handleWebhook(req.params.pmId, req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// ==========================================================================
// Internal API (called by ADK agent tools)
// ==========================================================================

const { PlatformBrowser } = require('./browser/platform-browser');
const activeBrowsers = new Map();

async function getBrowser(pmId) {
  if (!activeBrowsers.has(pmId)) {
    const browser = new PlatformBrowser(pmId);
    await browser.init();
    activeBrowsers.set(pmId, browser);
  }
  return activeBrowsers.get(pmId);
}

// Platform login
app.post('/internal/browser/login', async (req, res) => {
  const { pmId, platform, email, password } = req.body;
  try {
    const browser = await getBrowser(pmId);
    let result;
    if (platform === 'airbnb') {
      result = await browser.loginAirbnb(email, password);
    } else {
      result = { status: 'error', message: `Platform ${platform} not yet supported` };
    }
    console.log(`[Browser] Login ${platform} for PM ${pmId}: ${result.status}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Submit 2FA code
app.post('/internal/browser/2fa', async (req, res) => {
  const { pmId, code } = req.body;
  try {
    const browser = await getBrowser(pmId);
    const result = await browser.submit2FA(code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Check inbox
app.post('/internal/browser/inbox', async (req, res) => {
  const { pmId, platform } = req.body;
  try {
    const browser = await getBrowser(pmId);
    let result;
    if (platform === 'airbnb') {
      result = await browser.checkAirbnbInbox();
    } else {
      result = { status: 'error', message: `Platform ${platform} not yet supported` };
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Send reply
app.post('/internal/browser/reply', async (req, res) => {
  const { pmId, threadUrl, message } = req.body;
  try {
    const browser = await getBrowser(pmId);
    const result = await browser.sendAirbnbReply(threadUrl, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ADK agents call this to send Telegram messages to PMs
app.post('/internal/telegram/send', async (req, res) => {
  const { pmId, message, buttons } = req.body;
  if (!pmId || !message) {
    return res.status(400).json({ error: 'Missing pmId or message' });
  }

  let options = {};
  if (buttons && buttons.length > 0) {
    // Format as Telegraf inline keyboard
    const keyboard = buttons.map((row) =>
      Array.isArray(row) ? row : [row]
    );
    options.reply_markup = { inline_keyboard: keyboard };
  }

  const sent = await botManager.sendMessage(pmId, message, options);
  res.json({ sent });
});

// ==========================================================================
// Onboarding API
// ==========================================================================

// Store credentials (encrypted)
app.post('/api/onboarding/credentials', (req, res) => {
  const { pmId, platform, email, password } = req.body;
  if (!pmId || !platform || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const encrypted = encryptCredentials({ email, password });
  // TODO: Store encrypted credentials in PostgreSQL
  console.log(`Credentials stored for PM ${pmId} / ${platform}`);
  res.json({ status: 'stored', platform });
});

// Verify platform connection
app.post('/api/onboarding/verify-connection', async (req, res) => {
  const { pmId, platform } = req.body;

  try {
    const result = await fetch(`${BROWSER_AGENT_URL}/check-inbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pm_id: pmId, platform }),
    });
    const data = await result.json();

    res.json({
      connected: data.status === 'ok',
      authRequired: data.status === 'auth_required',
      status: data.status,
    });
  } catch (err) {
    res.status(500).json({ error: 'Connection verification failed' });
  }
});

// Analyze communication style
app.post('/api/onboarding/analyze-style', async (req, res) => {
  const { conversations, preset } = req.body;

  if (preset && STYLE_PRESETS[preset]) {
    const guide = generateStyleGuide(null, preset);
    return res.json(guide);
  }

  if (conversations) {
    const analysis = await analyzeStyle(conversations);
    const guide = generateStyleGuide(analysis);
    return res.json(guide);
  }

  res.status(400).json({ error: 'Provide conversations or a preset' });
});

// Assign Telegram bot to PM
app.post('/api/onboarding/assign-bot', (req, res) => {
  const { pmId } = req.body;
  try {
    const result = botManager.assignBot(pmId);
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Get style presets
app.get('/api/onboarding/style-presets', (req, res) => {
  res.json(STYLE_PRESETS);
});

// Handle Mini App credential submission (validated via Telegram HMAC)
app.post('/api/onboarding/mini-app-credentials', (req, res) => {
  const { initData, botToken: reqBotToken, payload } = req.body;

  // Validate Telegram initData signature
  const token = reqBotToken || process.env.TELEGRAM_BOT_TOKENS?.split(',')[0];
  if (initData && token) {
    const { valid } = validateInitData(initData, token);
    if (!valid) {
      return res.status(403).json({ error: 'Invalid Telegram initData signature' });
    }
  }

  if (!payload?.pmId || !payload?.platform || !payload?.data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const encrypted = encryptCredentials({
    email: payload.data.email || '',
    password: payload.data.password || '',
  });

  // TODO: Store in PostgreSQL
  console.log(`Mini App credentials stored for PM ${payload.pmId} / ${payload.platform}`);
  res.json({ status: 'stored', platform: payload.platform });
});

// Serve Mini App static files
app.use('/onboarding', express.static(path.join(__dirname, 'telegram', 'mini-app')));

// ==========================================================================
// Inbox Polling Scheduler
// ==========================================================================

const activePollers = new Map();

function startPolling(pmId, platforms) {
  if (activePollers.has(pmId)) return;

  const interval = setInterval(async () => {
    for (const platform of platforms) {
      try {
        const result = await fetch(`${BROWSER_AGENT_URL}/check-inbox`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pm_id: pmId, platform }),
        });
        const data = await result.json();

        if (data.status === 'auth_required') {
          await botManager.sendMessage(pmId, formatSessionExpired(platform));
        } else if (data.messages && data.messages.length > 0) {
          // Route new messages to ADK Guest Comms agent via Alfred
          for (const msg of data.messages) {
            if (msg.needs_reply) {
              await fetch(`${ADK_RUNNER_URL}/task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  pm_id: pmId,
                  agent: 'guest_comms',
                  task: `New guest message needs a reply on ${platform}`,
                  context: msg,
                }),
              });
            }
          }
        }
      } catch (err) {
        console.error(`Polling failed for ${pmId}/${platform}:`, err.message);
      }
    }
  }, POLL_INTERVAL);

  activePollers.set(pmId, interval);
  console.log(`Polling started for PM ${pmId} every ${POLL_INTERVAL / 1000}s`);
}

function stopPolling(pmId) {
  const interval = activePollers.get(pmId);
  if (interval) {
    clearInterval(interval);
    activePollers.delete(pmId);
    console.log(`Polling stopped for PM ${pmId}`);
  }
}

// ==========================================================================
// Health & Status
// ==========================================================================

app.get('/api/health', async (req, res) => {
  const checks = {};

  // Check Ollama
  try {
    const ollamaRes = await fetch(`${ollamaConfig.baseUrl}/api/tags`);
    checks.ollama = ollamaRes.ok ? 'ok' : 'error';
  } catch {
    checks.ollama = 'unreachable';
  }

  // Check Browser Agent
  try {
    const browserRes = await fetch(`${BROWSER_AGENT_URL}/health`);
    checks.browserAgent = browserRes.ok ? 'ok' : 'error';
  } catch {
    checks.browserAgent = 'unreachable';
  }

  // Check ADK Agent Runner
  try {
    const adkRes = await fetch(`${ADK_RUNNER_URL}/health`);
    checks.adkRunner = adkRes.ok ? 'ok' : 'error';
  } catch {
    checks.adkRunner = 'unreachable';
  }

  checks.telegram = botManager.getStatus();
  checks.pollers = activePollers.size;

  const allOk = checks.ollama === 'ok' && checks.browserAgent === 'ok' && checks.adkRunner === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Bot pool status
app.get('/api/status/bots', (req, res) => {
  res.json(botManager.getStatus());
});

// ==========================================================================
// Start
// ==========================================================================

app.listen(PORT, async () => {
  console.log(`Host4Me backend running on port ${PORT}`);
  console.log(`Ollama: ${ollamaConfig.baseUrl}`);
  console.log(`ADK Runner: ${ADK_RUNNER_URL}`);
  console.log(`Browser Agents: ${BROWSER_AGENT_URL}`);
  console.log(`Poll interval: ${POLL_INTERVAL / 1000}s`);

  // Start all assigned Telegram bots
  await botManager.startAll();
});

module.exports = { app, botManager, startPolling, stopPolling };
