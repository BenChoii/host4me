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
const fs = require('fs');
const { BotManager } = require('./telegram/bot-manager');
const { validateInitData } = require('./telegram/mini-app/validate');
const { formatSessionExpired } = require('./telegram/notifications');
const { encryptCredentials } = require('./onboarding/credential-vault');
const { analyzeStyle, generateStyleGuide, STYLE_PRESETS } = require('./onboarding/style-learner');
const ollamaConfig = require('./config/ollama');
const { GmailService } = require('./gmail/monitor');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BROWSER_AGENT_URL = process.env.BROWSER_AGENT_URL || 'http://localhost:8100';
const ADK_RUNNER_URL = process.env.ADK_RUNNER_URL || 'http://localhost:3200';
const POLL_INTERVAL = parseInt(process.env.BROWSER_POLL_INTERVAL_MS || '180000', 10);
const GMAIL_POLL_INTERVAL = parseInt(process.env.GMAIL_POLL_INTERVAL_MS || '60000', 10);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

// ==========================================================================
// Telegram Bot Manager
// ==========================================================================

const botManager = new BotManager();

// Conversation history per PM (in-memory for now, move to DB later)
const conversations = new Map();

// Gmail services per PM
const gmailServices = new Map();

// Pending Gmail OAuth flows: pmId -> GmailService (waiting for auth code)
const pendingGmailAuth = new Map();

const ALFRED_SYSTEM_PROMPT = `You are Alfred, the AI concierge for Host4Me. You are a premium, full-service AI property manager. You handle EVERYTHING so the PM can focus on growth.

═══ ABSOLUTE RULES — VIOLATION = FAILURE ═══
1. NEVER invent, fabricate, or predict browser results. You do NOT know what is on the screen.
2. NEVER generate fake guest names, messages, listings, inbox contents, or booking details.
3. NEVER write "BROWSER_DATA" in your replies — that tag is ONLY injected by the system.
4. When you use a browser command, your reply MUST be SHORT — just acknowledge the action. Examples:
   - "Submitting your code now..." + [SUBMIT_2FA: code=123456]
   - "Logging in now..." + [LOGIN_REQUEST: platform=airbnb, email=X, password=Y]
   - "Let me check your inbox." + [CHECK_INBOX]
5. NEVER describe what the browser shows UNLESS you received a [BROWSER_DATA] tag in a PREVIOUS message from the system.
6. If you have not received [BROWSER_DATA], you have ZERO information about the browser state. Say "Let me check." and use a command.
7. NEVER combine [SUBMIT_2FA] with [CHECK_INBOX] in the same reply. Submit 2FA first. The system will check inbox automatically after success.
8. Only reference data from [BROWSER_DATA] tags that appear in YOUR conversation history.
9. NEVER re-introduce yourself after the first message.
10. REMEMBER credentials. If the PM already gave you their email and password in this conversation, REUSE them. NEVER ask for credentials you already have. If a login fails and you need to retry, use the SAME credentials from earlier in the chat.
10. Be concise but thorough. Anticipate what the PM needs.

═══ COMMANDS ═══
Include these tags to trigger actions:

GMAIL (Primary — connect this FIRST):
- [CONNECT_GMAIL] — Start Gmail OAuth flow. Alfred will send a link for the PM to click and grant access. No passwords needed.
- [GMAIL_AUTH_CODE: code=X] — PM sends back the authorization code from Google.
- [CHECK_GMAIL] — Check for recent platform emails (Airbnb, VRBO, Booking.com)
- [READ_EMAIL: id=abc123] — Read a specific email in full

BROWSER (Secondary — for actions on platforms):
- [LOGIN_REQUEST: platform=airbnb, email=X, password=Y]
- [CHECK_BROWSER] — Fresh screenshot of current page
- [CHECK_INBOX] — List all inbox conversations
- [SUBMIT_2FA: code=123456]
- [BROWSER_ACTION: description] — ANY action on the platform

═══ YOUR RESPONSIBILITIES ═══

1. CALENDAR MANAGEMENT (Critical)
   - When a booking comes in on one platform, IMMEDIATELY block those dates on ALL other platforms the property is listed on
   - When a cancellation happens, unblock those dates everywhere
   - Add cleaning buffer days between bookings (ask PM their preference, default 1 day)
   - Check for calendar conflicts daily
   - Example: "New booking on Airbnb for Sunset Mews, Jun 5-10. I've blocked those dates on VRBO and Booking.com."

2. GUEST COMMUNICATION
   - Reply to all guest messages in the PM's voice/tone
   - Handle: pre-booking questions, check-in instructions, mid-stay issues, checkout reminders, review responses
   - Be warm, helpful, and specific — not generic
   - If you don't know the answer, check the listing/house rules first via [BROWSER_ACTION]

3. FINANCIAL ESCALATION (ALWAYS escalate to PM)
   - Guest asks for something that costs money → tell PM, get approval
   - Maintenance/repair needed → notify PM with details and cost estimate
   - Refund requests → NEVER approve alone, escalate immediately
   - Damage discovered → document via screenshot, notify PM
   - Format: "🟡 *APPROVAL NEEDED* — [Guest] at [Property] requests [thing]. Estimated cost: $X. Reply YES to approve or NO to decline."

4. CLEANING COORDINATION
   - Track checkout/check-in times for each property
   - Send cleaning crew notification (email or message) with:
     * Property address
     * Checkout time + next check-in time
     * Special instructions (extra guests, pet stayed, etc.)
   - Confirm cleaning was completed before next guest arrives
   - Alert PM if cleaning crew hasn't confirmed

5. OPERATIONS
   - Guest requests (early check-in, late checkout, extra supplies) → handle if free, escalate if costs money
   - Maintenance issues → assess urgency, escalate with context
   - Supply restocking → track and alert when running low
   - Lock code management → update codes between guests if applicable

6. REPORTING & BRIEFINGS
   - Daily briefing at end of day: bookings, messages handled, issues, tomorrow's check-ins/outs
   - Weekly: occupancy rate, revenue, response time avg, guest satisfaction
   - Instant alerts for: new bookings, cancellations, emergencies, money-related requests

7. LISTING OPTIMIZATION (Background)
   - Monitor competitor pricing periodically
   - Suggest pricing adjustments based on demand/events
   - Optimize listing descriptions and titles for search
   - Suggest photo improvements

═══ ESCALATION LEVELS ═══
🔴 URGENT (notify immediately): safety, lockouts, property damage, legal threats
🟡 ACTION REQUIRED (need PM decision): money requests, refunds, maintenance, conflicts
🟢 INFORMATIONAL (daily briefing): routine messages handled, bookings confirmed, cleaning scheduled

═══ ONBOARDING (follow this order) ═══
1. GMAIL FIRST: Ask "What Gmail do you use for your booking platforms?"
   Then say: "Let me connect to your Gmail so I can monitor booking emails."
   Use [CONNECT_GMAIL] — this sends the PM a link to click. No passwords needed.
   The PM clicks the link, grants access, and sends back a code.
   Then use [GMAIL_AUTH_CODE: code=THE_CODE_THEY_SEND]

2. Once Gmail is connected, I'll automatically monitor for new booking emails from Airbnb, VRBO, Booking.com — every 60 seconds.

3. Ask which platforms they use (Airbnb, VRBO, Booking.com, etc.)

4. Ask about their properties: names, addresses, cleaning crew contacts, check-in/out times.

5. Ask about preferences: cleaning buffer days, auto-reply style, escalation preferences.

6. OPTIONAL: Offer to log into platforms for direct actions → [LOGIN_REQUEST]
   (Gmail monitoring handles notifications — platform login is for taking actions.)

═══ GOLDEN RULE ═══
Act like you're the PM's most trusted employee. Be proactive, thorough, and never let anything slip through the cracks. If something feels wrong, flag it. If you're unsure, ask. The PM should feel like they can sleep peacefully knowing you're handling everything.`;

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
          // Parse all command tags
          const loginMatch = reply.match(/\[LOGIN_REQUEST:\s*platform=(\w+),\s*email=([^,]+),\s*password=([^\]]+)\]/);
          const checkBrowser = reply.includes('[CHECK_BROWSER]');
          const checkInbox = reply.includes('[CHECK_INBOX]');
          const submit2fa = reply.match(/\[SUBMIT_2FA:\s*code=([^\]]+)\]/);
          const browserAction = reply.match(/\[BROWSER_ACTION:\s*([^\]]+)\]/);
          const connectGmail = reply.includes('[CONNECT_GMAIL]');
          const gmailAuthCode = reply.match(/\[GMAIL_AUTH_CODE:\s*code=([^\]]+)\]/);
          const checkGmail = reply.includes('[CHECK_GMAIL]');
          const readEmail = reply.match(/\[READ_EMAIL:\s*id=([^\]]+)\]/);

          // Clean all tags from reply
          let cleanReply = reply
            .replace(/\[LOGIN_REQUEST:[^\]]+\]/g, '')
            .replace(/\[CHECK_BROWSER\]/g, '')
            .replace(/\[CHECK_INBOX\]/g, '')
            .replace(/\[SUBMIT_2FA:[^\]]+\]/g, '')
            .replace(/\[BROWSER_ACTION:[^\]]+\]/g, '')
            .replace(/\[CONNECT_GMAIL\]/g, '')
            .replace(/\[GMAIL_AUTH_CODE:[^\]]+\]/g, '')
            .replace(/\[CHECK_GMAIL\]/g, '')
            .replace(/\[READ_EMAIL:[^\]]+\]/g, '')
            .trim();

          // Strip hallucinated BROWSER_DATA — the model should never produce this
          // Also strip anything after "BROWSER_DATA" since it's always fabricated
          cleanReply = cleanReply
            .replace(/\.?BROWSER_DATA[\s\S]*/g, '')
            .replace(/\[BROWSER_DATA[^\]]*\]/g, '')
            .replace(/BROWSER_DATA/g, '')
            .trim();

          // If the model hallucinated everything and nothing is left, use a safe default
          if (!cleanReply && (submit2fa || loginMatch)) {
            cleanReply = submit2fa ? 'Submitting your code now...' : 'Logging in now...';
          }

          // Add Alfred's reply to conversation history
          history.push({ role: 'model', parts: [{ text: cleanReply }] });
          if (cleanReply) await botManager.sendMessage(pmId, cleanReply);

          // ── Execute browser commands SEQUENTIALLY with priority ──
          // Priority: LOGIN > 2FA > others (login/2FA block all other commands)
          // This prevents race conditions on the shared browser session.

          // LOGIN — highest priority, blocks everything else
          if (loginMatch) {
            const [, platform, loginEmail, loginPassword] = loginMatch;
            console.log(`[Browser] Login triggered for PM ${pmId} on ${platform}`);

            try {
              await botManager.sendMessage(pmId, `🔄 Launching browser agent to log into ${platform}... this may take a minute.`);
              const result = await runBrowserAgent('login', pmId, loginEmail.trim(), loginPassword.trim());

              console.log(`[Browser] Login result for ${pmId}:`, JSON.stringify(result).slice(0, 500));

              if (result.status === 'logged_in') {
                await botManager.sendMessage(pmId, `✅ Logged into ${platform}. Checking your inbox now...`);
                const inbox = await runBrowserAgent('inbox', pmId, platform);
                console.log(`[Browser] Inbox result for ${pmId}:`, JSON.stringify(inbox).slice(0, 500));

                const browserData = `[BROWSER_DATA] Login status: ${result.status}. Inbox check: ${JSON.stringify(inbox)}`;
                history.push({ role: 'user', parts: [{ text: browserData }] });

                if (inbox.status === 'ok' && inbox.messages && inbox.messages.length > 0) {
                  const summary = inbox.messages.map(m => `• ${m.guest_name}: ${m.message_preview || '(no preview)'} ${m.is_unread ? '🔴' : ''}`).join('\n');
                  await botManager.sendMessage(pmId, `📨 Found ${inbox.count} conversation(s):\n\n${summary}`);
                  history.push({ role: 'model', parts: [{ text: `Found ${inbox.count} conversations. ${summary}` }] });
                } else if (inbox.status === 'auth_required') {
                  await botManager.sendMessage(pmId, `⚠️ Login appeared to work but the inbox page redirected to login. Your credentials may need to be re-entered, or Airbnb may require verification.`);
                } else if (inbox.status === 'ok' && (!inbox.messages || inbox.messages.length === 0)) {
                  await botManager.sendMessage(pmId, `📭 Connected to ${platform}. No conversations found in the inbox, or the page layout couldn't be parsed. I'll keep trying to read it.`);
                } else {
                  await botManager.sendMessage(pmId, `⚠️ Connected but couldn't read inbox: ${inbox.message || inbox.status}`);
                }
              } else if (result.status === '2fa_required') {
                const method = result.method || 'unknown';
                const methodText = method === 'email' ? 'Check your email' : method === 'phone' ? 'Check your phone/SMS' : 'Check your email or phone';
                const detail = result.analysis ? `\n\nAirbnb says: "${result.analysis.split('\n').slice(1).join(' ').trim().slice(0, 200)}"` : '';
                await botManager.sendMessage(pmId, `🔐 ${platform} needs a verification code. ${methodText} and send me the code.${detail}`);
                history.push({ role: 'model', parts: [{ text: `[BROWSER_DATA] Login requires 2FA via ${method}. ${result.analysis || ''}` }] });
              } else {
                await botManager.sendMessage(pmId, `⚠️ Could not log in to ${platform}: ${result.message || result.status}. This might be due to Airbnb blocking automated browsers. Let me know if you want to try again.`);
                history.push({ role: 'model', parts: [{ text: `[BROWSER_DATA] Login failed: ${result.message || result.status}` }] });
              }
            } catch (err) {
              console.error(`[Browser] Login error for ${pmId}:`, err.message);
              await botManager.sendMessage(pmId, `⚠️ Had trouble logging in: ${err.message}`);
              history.push({ role: 'model', parts: [{ text: `[BROWSER_DATA] Login error: ${err.message}` }] });
            }

          // 2FA — second priority, blocks inbox/screenshot/action
          } else if (submit2fa) {
            try {
              await botManager.sendMessage(pmId, `🔐 Submitting verification code...`);
              const result = await runBrowserAgent('2fa', pmId, submit2fa[1].trim());
              const browserData = `[BROWSER_DATA] 2FA result: ${JSON.stringify(result)}`;
              history.push({ role: 'user', parts: [{ text: browserData }] });

              // Check if the browser was on the wrong page
              if (result.status === 'error' && result.message && result.message.includes('login page')) {
                await botManager.sendMessage(pmId, `⚠️ The browser session expired and went back to the login page. I'll re-login with your saved credentials.`);
                history.push({ role: 'model', parts: [{ text: `[BROWSER_DATA] Session expired — need to re-login before 2FA.` }] });
                // Don't ask for credentials again — tell Gemini to retry
                history.push({ role: 'user', parts: [{ text: 'The browser session expired. Please log in again using the credentials I already gave you.' }] });
              }
              // After successful 2FA, automatically check inbox
              else {
                const analysis = (result.analysis || '').toUpperCase();
                if (analysis.includes('LOGGED') || analysis.includes('SUCCESS') || analysis.includes('DASHBOARD') || analysis.includes('HOSTING')) {
                  await botManager.sendMessage(pmId, `✅ Verification successful! Checking your inbox...`);
                  const inbox = await runBrowserAgent('inbox', pmId);
                  const inboxData = `[BROWSER_DATA] Inbox after 2FA: ${JSON.stringify(inbox)}`;
                  history.push({ role: 'user', parts: [{ text: inboxData }] });
                  if (inbox.messages && inbox.messages.length > 0) {
                    const summary = inbox.messages.map(m => `• ${m.guest_name}: ${m.preview || ''} ${m.is_unread ? '🔴' : ''}`).join('\n');
                    await botManager.sendMessage(pmId, `📨 Found ${inbox.count} conversation(s):\n\n${summary}`);
                  } else {
                    await botManager.sendMessage(pmId, inbox.raw || '📭 No conversations found or could not read inbox.');
                  }
                } else {
                  await botManager.sendMessage(pmId, `${result.analysis || result.message || 'Code submitted'}`);
                }
              }
            } catch (err) {
              await botManager.sendMessage(pmId, `⚠️ Could not submit code: ${err.message}`);
            }

          // Lower priority commands — only run if no login/2FA
          } else {
            // CHECK_BROWSER
            if (checkBrowser) {
              try {
                const result = await runBrowserAgent('screenshot', pmId, 'Describe everything you see on this page. What is the current state? Is there a login, 2FA prompt, inbox, or error?');
                const browserData = `[BROWSER_DATA] Current page: ${result.url || 'unknown'}. Analysis: ${result.analysis || result.message || 'no data'}`;
                history.push({ role: 'user', parts: [{ text: browserData }] });
                await botManager.sendMessage(pmId, `📸 ${result.analysis || result.message || 'Could not analyze page'}`);
              } catch (err) {
                await botManager.sendMessage(pmId, `⚠️ Could not check browser: ${err.message}`);
              }
            }

            // CHECK_INBOX — only after screenshot (sequential on same session)
            if (checkInbox) {
              try {
                await botManager.sendMessage(pmId, '📨 Checking your inbox...');
                const result = await runBrowserAgent('inbox', pmId);
                const browserData = `[BROWSER_DATA] Inbox: ${JSON.stringify(result)}`;
                history.push({ role: 'user', parts: [{ text: browserData }] });
                if (result.messages && result.messages.length > 0) {
                  const summary = result.messages.map(m => `• ${m.guest_name}: ${m.preview || ''} ${m.is_unread ? '🔴' : ''}`).join('\n');
                  await botManager.sendMessage(pmId, `Found ${result.count} conversations:\n\n${summary}`);
                } else {
                  await botManager.sendMessage(pmId, result.raw || '📭 No conversations found or could not read inbox.');
                }
              } catch (err) {
                await botManager.sendMessage(pmId, `⚠️ Could not check inbox: ${err.message}`);
              }
            }

            // BROWSER_ACTION
            if (browserAction) {
              try {
                await botManager.sendMessage(pmId, `🔄 Working on it...`);
                const result = await runBrowserAgent('action', pmId, browserAction[1].trim());
                const browserData = `[BROWSER_DATA] Action result: ${JSON.stringify(result)}`;
                history.push({ role: 'user', parts: [{ text: browserData }] });
                await botManager.sendMessage(pmId, `${result.analysis || result.message || 'Action completed'}`);
              } catch (err) {
                await botManager.sendMessage(pmId, `⚠️ Could not perform action: ${err.message}`);
              }
            }

            // ── Gmail Commands ──

            // CONNECT_GMAIL — start OAuth2 flow
            if (connectGmail) {
              if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
                await botManager.sendMessage(pmId, `⚠️ Gmail integration isn't configured yet. The Host4Me admin needs to set up Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env).`);
              } else {
                try {
                  const service = new GmailService({
                    clientId: GOOGLE_CLIENT_ID,
                    clientSecret: GOOGLE_CLIENT_SECRET,
                    redirectUri: GOOGLE_REDIRECT_URI,
                    dataDir: process.env.HOST4ME_DATA_DIR || '/opt/host4me/data',
                  });
                  const authUrl = service.getAuthUrl();
                  pendingGmailAuth.set(pmId, service);

                  await botManager.sendMessage(pmId,
                    `📧 Click this link to connect your Gmail:\n\n${authUrl}\n\n` +
                    `After you grant access, Google will give you a code. Send that code back to me.`
                  );
                  history.push({ role: 'model', parts: [{ text: `[SYSTEM] Gmail OAuth link sent. Waiting for auth code.` }] });
                } catch (err) {
                  await botManager.sendMessage(pmId, `⚠️ Could not start Gmail connection: ${err.message}`);
                }
              }
            }

            // GMAIL_AUTH_CODE — complete OAuth2 flow
            if (gmailAuthCode) {
              const code = gmailAuthCode[1].trim();
              const service = pendingGmailAuth.get(pmId);
              if (!service) {
                await botManager.sendMessage(pmId, `⚠️ No pending Gmail connection. Use [CONNECT_GMAIL] first.`);
              } else {
                try {
                  await botManager.sendMessage(pmId, `📧 Connecting...`);
                  const { email } = await service.authorize(code, pmId);
                  pendingGmailAuth.delete(pmId);

                  // Start polling
                  service.startPolling(GMAIL_POLL_INTERVAL, async (pmId, email) => {
                    const msg = `${email.typeLabel} from ${email.platform.toUpperCase()}\n📩 ${email.subject}\n📅 ${new Date(email.date).toLocaleString()}`;
                    await botManager.sendMessage(pmId, msg);

                    const hist = conversations.get(pmId) || [];
                    hist.push({ role: 'user', parts: [{ text: `[EMAIL_NOTIFICATION] ${email.typeLabel} | Platform: ${email.platform} | Subject: ${email.subject} | From: ${email.from}` }] });
                    conversations.set(pmId, hist);
                  });
                  gmailServices.set(pmId, service);

                  await botManager.sendMessage(pmId,
                    `✅ Gmail connected! Monitoring ${email} for booking emails from Airbnb, VRBO, and Booking.com.\n\n` +
                    `I'll notify you the moment anything comes in. What's next?`
                  );
                  history.push({ role: 'model', parts: [{ text: `[SYSTEM] Gmail connected: ${email}. Monitoring active.` }] });
                } catch (err) {
                  console.error(`[Gmail] Auth error for ${pmId}:`, err.message);
                  await botManager.sendMessage(pmId, `⚠️ Could not connect Gmail: ${err.message}\n\nPlease try again — use [CONNECT_GMAIL] to get a new link.`);
                }
              }
            }

            // CHECK_GMAIL
            if (checkGmail) {
              const service = gmailServices.get(pmId);
              if (!service) {
                await botManager.sendMessage(pmId, `📧 Gmail is not connected yet. Let's connect it first.`);
                history.push({ role: 'model', parts: [{ text: `[SYSTEM] Gmail not connected. Need to run onboarding.` }] });
              } else {
                try {
                  await botManager.sendMessage(pmId, `📧 Checking recent platform emails...`);
                  const emails = await service.fetchRecentEmails(10);
                  if (emails.length > 0) {
                    const summary = emails.map(e =>
                      `${e.typeLabel} | ${e.platform.toUpperCase()} | ${e.subject}`
                    ).join('\n');
                    await botManager.sendMessage(pmId, `📬 Recent platform emails:\n\n${summary}`);
                    history.push({ role: 'user', parts: [{ text: `[EMAIL_DATA] Recent emails:\n${summary}` }] });
                  } else {
                    await botManager.sendMessage(pmId, `📭 No recent emails from booking platforms found.`);
                  }
                } catch (err) {
                  await botManager.sendMessage(pmId, `⚠️ Could not check Gmail: ${err.message}`);
                }
              }
            }

            // READ_EMAIL
            if (readEmail) {
              const service = gmailServices.get(pmId);
              if (!service) {
                await botManager.sendMessage(pmId, `📧 Gmail is not connected.`);
              } else {
                try {
                  const emailContent = await service.readEmail(readEmail[1].trim());
                  const preview = (emailContent.body || emailContent.snippet || '').slice(0, 1000);
                  await botManager.sendMessage(pmId, `📧 *${emailContent.subject}*\nFrom: ${emailContent.from}\nDate: ${emailContent.date}\n\n${preview}`);
                  history.push({ role: 'user', parts: [{ text: `[EMAIL_DATA] Full email: Subject: ${emailContent.subject}. Content: ${preview}` }] });
                } catch (err) {
                  await botManager.sendMessage(pmId, `⚠️ Could not read email: ${err.message}`);
                }
              }
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

const { runBrowserAgent } = require('./browser/run-agent');
const activeBrowsers = new Map();

// Platform login via browser-use agent
app.post('/internal/browser/login', async (req, res) => {
  const { pmId, platform, email, password } = req.body;
  const result = await runBrowserAgent('login', pmId, email, password);
  console.log(`[Browser] Login ${platform} for PM ${pmId}: ${result.status}`);
  res.json(result);
});

// Check inbox via browser-use agent
app.post('/internal/browser/inbox', async (req, res) => {
  const { pmId, platform } = req.body;
  const result = await runBrowserAgent('inbox', pmId, platform || 'airbnb');
  res.json(result);
});

// Send reply via browser-use agent
app.post('/internal/browser/reply', async (req, res) => {
  const { pmId, guestName, message } = req.body;
  const result = await runBrowserAgent('reply', pmId, guestName, message);
  res.json(result);
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
// Debug — see what the browser actually shows
// ==========================================================================

app.get('/api/debug/screenshot', async (req, res) => {
  try {
    const resp = await fetch(`${BROWSER_AGENT_URL}/debug/screenshot?pm=default`);
    if (!resp.ok) return res.status(resp.status).json({ error: 'no screenshot' });
    const buffer = await resp.arrayBuffer();
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  console.log(`Gmail poll interval: ${GMAIL_POLL_INTERVAL / 1000}s`);
  console.log(`Google OAuth: ${GOOGLE_CLIENT_ID ? 'configured' : 'NOT configured'}`);

  // Restore saved Gmail connections
  if (GOOGLE_CLIENT_ID) {
    const dataDir = process.env.HOST4ME_DATA_DIR || '/opt/host4me/data';
    const gmailDir = path.join(dataDir, 'gmail');
    if (fs.existsSync(gmailDir)) {
      const pmDirs = fs.readdirSync(gmailDir);
      for (const pmId of pmDirs) {
        try {
          const service = new GmailService({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            redirectUri: GOOGLE_REDIRECT_URI,
            dataDir,
          });
          const loaded = await service.loadSavedTokens(pmId);
          if (loaded) {
            service.startPolling(GMAIL_POLL_INTERVAL, async (pmId, email) => {
              const msg = `${email.typeLabel} from ${email.platform.toUpperCase()}\n📩 ${email.subject}\n📅 ${new Date(email.date).toLocaleString()}`;
              await botManager.sendMessage(pmId, msg);
            });
            gmailServices.set(pmId, service);
            console.log(`[Gmail] Restored monitoring for PM ${pmId}`);
          }
        } catch (err) {
          console.error(`[Gmail] Failed to restore PM ${pmId}: ${err.message}`);
        }
      }
    }
  }

  // Start all assigned Telegram bots
  await botManager.startAll();
});

module.exports = { app, botManager, startPolling, stopPolling };
