/**
 * Gmail Service — OAuth2-based Gmail API monitoring for booking platforms.
 *
 * Flow:
 *   1. PM asks Alfred to connect Gmail
 *   2. Alfred generates an OAuth2 URL → sends via Telegram
 *   3. PM clicks link, grants access, gets a code
 *   4. PM sends code to Alfred → exchanged for tokens
 *   5. Gmail monitoring starts — polls for new booking emails
 *
 * No App Passwords needed. Works with any Gmail account.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Booking platform sender patterns
const PLATFORM_SENDERS = {
  airbnb: ['airbnb.com', 'guest.airbnb.com'],
  vrbo: ['vrbo.com', 'homeaway.com'],
  booking: ['booking.com', 'guest.booking.com'],
};

// Email type detection patterns
const EMAIL_TYPES = [
  { type: 'new_booking',   label: '🏠 New Booking',      patterns: [/reservation confirm/i, /booking confirm/i, /new reservation/i, /booked your/i, /you have a new/i] },
  { type: 'cancellation',  label: '❌ Cancellation',      patterns: [/cancel/i, /cancelled/i, /cancellation/i] },
  { type: 'guest_message', label: '💬 Guest Message',     patterns: [/message from/i, /sent you a message/i, /new message/i, /replied/i] },
  { type: 'inquiry',       label: '❓ Inquiry',           patterns: [/inquiry/i, /enquiry/i, /wants to know/i, /question about/i, /interested in/i] },
  { type: 'review',        label: '⭐ Review',            patterns: [/review/i, /left you a review/i, /wrote a review/i] },
  { type: 'payout',        label: '💰 Payout',            patterns: [/payout/i, /payment/i, /earnings/i, /deposit/i, /paid out/i] },
  { type: 'reminder',      label: '📅 Reminder',          patterns: [/check-in/i, /checkout/i, /arriving/i, /upcoming stay/i, /tomorrow/i] },
  { type: 'alteration',    label: '🔄 Alteration',        patterns: [/alter/i, /change request/i, /modification/i, /date change/i] },
  { type: 'calendar',      label: '📆 Calendar',          patterns: [/calendar/i, /availability/i, /blocked dates/i] },
];

function detectPlatform(from) {
  const lower = (from || '').toLowerCase();
  for (const [platform, domains] of Object.entries(PLATFORM_SENDERS)) {
    if (domains.some(d => lower.includes(d))) return platform;
  }
  return null;
}

function detectEmailType(subject) {
  for (const { type, patterns } of EMAIL_TYPES) {
    if (patterns.some(p => p.test(subject || ''))) return type;
  }
  return 'other';
}

function getTypeLabel(type) {
  const found = EMAIL_TYPES.find(e => e.type === type);
  return found ? found.label : '📧 Notification';
}


class GmailService {
  constructor({ clientId, clientSecret, redirectUri, dataDir }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.dataDir = dataDir || '/opt/host4me/data';

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.gmail = null;
    this.pollTimer = null;
    this.lastCheckTime = null;
    this.pmId = null;
    this.onNewEmail = null;
    this.connected = false;
    this.userEmail = null;
  }

  /**
   * Generate the OAuth2 URL for the PM to click.
   */
  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
  }

  /**
   * Exchange the authorization code for tokens and save them.
   */
  async authorize(code, pmId) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.pmId = pmId;

    // Get the user's email address
    const profile = await this.gmail.users.getProfile({ userId: 'me' });
    this.userEmail = profile.data.emailAddress;

    // Save tokens to disk for persistence across restarts
    const tokenDir = path.join(this.dataDir, 'gmail', pmId);
    fs.mkdirSync(tokenDir, { recursive: true });
    fs.writeFileSync(
      path.join(tokenDir, 'tokens.json'),
      JSON.stringify({ tokens, email: this.userEmail }, null, 2)
    );

    this.connected = true;
    this.lastCheckTime = new Date().toISOString();

    console.log(`[Gmail] Authorized: ${this.userEmail} for PM ${pmId}`);
    return { email: this.userEmail };
  }

  /**
   * Load saved tokens (for server restarts).
   */
  async loadSavedTokens(pmId) {
    const tokenPath = path.join(this.dataDir, 'gmail', pmId, 'tokens.json');
    if (!fs.existsSync(tokenPath)) return false;

    try {
      const saved = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      this.oauth2Client.setCredentials(saved.tokens);
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      this.pmId = pmId;
      this.userEmail = saved.email;
      this.connected = true;
      this.lastCheckTime = new Date().toISOString();

      // Refresh token if needed
      this.oauth2Client.on('tokens', (newTokens) => {
        const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        existing.tokens = { ...existing.tokens, ...newTokens };
        fs.writeFileSync(tokenPath, JSON.stringify(existing, null, 2));
      });

      console.log(`[Gmail] Loaded saved tokens for ${this.userEmail} (PM ${pmId})`);
      return true;
    } catch (err) {
      console.error(`[Gmail] Failed to load tokens: ${err.message}`);
      return false;
    }
  }

  /**
   * Start polling for new emails.
   */
  startPolling(intervalMs, onNewEmail) {
    this.onNewEmail = onNewEmail;
    console.log(`[Gmail] Polling every ${intervalMs / 1000}s for ${this.userEmail}`);
    this.pollTimer = setInterval(() => this.poll(), intervalMs);
    // Poll immediately
    setTimeout(() => this.poll(), 2000);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll for new emails from booking platforms.
   */
  async poll() {
    if (!this.connected || !this.gmail) return;

    try {
      // Build search query for booking platform emails since last check
      const query = `newer_than:1d (from:airbnb.com OR from:vrbo.com OR from:booking.com OR from:homeaway.com)`;

      const res = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 20,
      });

      const messages = res.data.messages || [];
      const newEmails = [];

      for (const msg of messages) {
        // Get message details
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = detail.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const internalDate = new Date(parseInt(detail.data.internalDate));

        // Only process emails newer than our last check
        if (this.lastCheckTime && internalDate <= new Date(this.lastCheckTime)) {
          continue;
        }

        const platform = detectPlatform(from);
        if (!platform) continue;

        const emailType = detectEmailType(subject);
        newEmails.push({
          id: msg.id,
          from,
          subject,
          date: internalDate.toISOString(),
          platform,
          type: emailType,
          typeLabel: getTypeLabel(emailType),
        });
      }

      // Update last check time
      this.lastCheckTime = new Date().toISOString();

      if (newEmails.length > 0) {
        console.log(`[Gmail] ${newEmails.length} new platform email(s) for ${this.userEmail}`);
        for (const email of newEmails) {
          try {
            if (this.onNewEmail) await this.onNewEmail(this.pmId, email);
          } catch (err) {
            console.error(`[Gmail] Notification callback error: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`[Gmail] Poll error: ${err.message}`);
      if (err.message.includes('invalid_grant') || err.message.includes('Token has been expired')) {
        console.log(`[Gmail] Token expired for ${this.userEmail}, needs re-authorization`);
        this.connected = false;
      }
    }
  }

  /**
   * Fetch recent platform emails (for [CHECK_GMAIL] command).
   */
  async fetchRecentEmails(count = 10) {
    if (!this.connected || !this.gmail) throw new Error('Gmail not connected');

    const query = `(from:airbnb.com OR from:vrbo.com OR from:booking.com OR from:homeaway.com)`;
    const res = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: count,
    });

    const messages = res.data.messages || [];
    const results = [];

    for (const msg of messages) {
      const detail = await this.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = detail.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const platform = detectPlatform(from);

      results.push({
        id: msg.id,
        from,
        subject,
        date,
        platform: platform || 'unknown',
        type: detectEmailType(subject),
        typeLabel: getTypeLabel(detectEmailType(subject)),
        snippet: detail.data.snippet || '',
      });
    }

    return results;
  }

  /**
   * Read full email content (for [READ_EMAIL] command).
   */
  async readEmail(messageId) {
    if (!this.connected || !this.gmail) throw new Error('Gmail not connected');

    const detail = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = detail.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    // Extract text body
    let body = '';
    function extractText(part) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      if (part.parts) part.parts.forEach(extractText);
    }
    extractText(detail.data.payload);

    // Fallback to snippet
    if (!body) body = detail.data.snippet || '';

    return { from, subject, date, body, snippet: detail.data.snippet };
  }
}


module.exports = { GmailService, detectPlatform, detectEmailType, getTypeLabel };
