/**
 * Gmail Monitor — IMAP-based email monitoring for booking platform notifications.
 *
 * Connects to a PM's Gmail via IMAP (App Password), polls for new emails
 * from Airbnb, VRBO, Booking.com, and notifies via callback.
 *
 * Usage:
 *   const monitor = new GmailMonitor({ email, appPassword, onNewEmail });
 *   await monitor.connect();
 *   monitor.startPolling(interval);
 */

const { ImapFlow } = require('imapflow');

// Booking platform sender patterns
const PLATFORM_SENDERS = {
  airbnb: [
    '@airbnb.com',
    '@guest.airbnb.com',
    'airbnb.com',
  ],
  vrbo: [
    '@vrbo.com',
    '@homeaway.com',
    'vrbo.com',
  ],
  booking: [
    '@booking.com',
    '@guest.booking.com',
    'booking.com',
  ],
};

// Email type detection patterns (subject line matching)
const EMAIL_TYPES = [
  { type: 'new_booking',     patterns: [/reservation confirm/i, /booking confirm/i, /new reservation/i, /you have a new/i, /booked your/i] },
  { type: 'cancellation',    patterns: [/cancel/i, /cancelled/i, /cancellation/i] },
  { type: 'guest_message',   patterns: [/message from/i, /sent you a message/i, /new message/i, /replied/i] },
  { type: 'inquiry',         patterns: [/inquiry/i, /enquiry/i, /wants to know/i, /question about/i, /interested in/i] },
  { type: 'review',          patterns: [/review/i, /left you a review/i, /wrote a review/i] },
  { type: 'payout',          patterns: [/payout/i, /payment/i, /earnings/i, /deposit/i, /paid out/i] },
  { type: 'reminder',        patterns: [/check-in/i, /checkout/i, /arriving/i, /upcoming stay/i, /tomorrow/i] },
  { type: 'alteration',      patterns: [/alter/i, /change request/i, /modification/i, /date change/i] },
  { type: 'calendar',        patterns: [/calendar/i, /availability/i, /blocked dates/i] },
];

function detectPlatform(from) {
  const lower = (from || '').toLowerCase();
  for (const [platform, patterns] of Object.entries(PLATFORM_SENDERS)) {
    if (patterns.some(p => lower.includes(p))) return platform;
  }
  return null;
}

function detectEmailType(subject) {
  const s = subject || '';
  for (const { type, patterns } of EMAIL_TYPES) {
    if (patterns.some(p => p.test(s))) return type;
  }
  return 'other';
}

function formatEmailType(type) {
  const labels = {
    new_booking: '🏠 New Booking',
    cancellation: '❌ Cancellation',
    guest_message: '💬 Guest Message',
    inquiry: '❓ Inquiry',
    review: '⭐ Review',
    payout: '💰 Payout',
    reminder: '📅 Reminder',
    alteration: '🔄 Alteration',
    calendar: '📆 Calendar Update',
    other: '📧 Notification',
  };
  return labels[type] || labels.other;
}


class GmailMonitor {
  constructor({ email, appPassword, pmId, onNewEmail }) {
    this.email = email;
    this.appPassword = appPassword;
    this.pmId = pmId;
    this.onNewEmail = onNewEmail;
    this.client = null;
    this.pollTimer = null;
    this.lastSeenUid = 0;
    this.connected = false;
  }

  async connect() {
    this.client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: this.email,
        pass: this.appPassword,
      },
      logger: false,
    });

    try {
      await this.client.connect();
      this.connected = true;
      console.log(`[Gmail] Connected: ${this.email}`);

      // Get the latest UID so we only notify on NEW emails going forward
      const lock = await this.client.getMailboxLock('INBOX');
      try {
        const status = await this.client.status('INBOX', { uidNext: true });
        this.lastSeenUid = status.uidNext - 1;
        console.log(`[Gmail] Starting from UID ${this.lastSeenUid}`);
      } finally {
        lock.release();
      }

      return { status: 'connected', email: this.email };
    } catch (err) {
      this.connected = false;
      console.error(`[Gmail] Connection failed: ${err.message}`);
      throw err;
    }
  }

  async disconnect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.client) {
      try { await this.client.logout(); } catch {}
      this.connected = false;
    }
  }

  startPolling(intervalMs = 60000) {
    console.log(`[Gmail] Polling every ${intervalMs / 1000}s for ${this.email}`);
    this.pollTimer = setInterval(() => this.poll(), intervalMs);
    // Also poll immediately
    this.poll();
  }

  async poll() {
    if (!this.connected) {
      try {
        await this.connect();
      } catch {
        return;
      }
    }

    let lock;
    try {
      lock = await this.client.getMailboxLock('INBOX');

      // Search for new emails since our last seen UID
      const newMessages = [];
      for await (const msg of this.client.fetch(
        { uid: `${this.lastSeenUid + 1}:*` },
        { envelope: true, bodyStructure: true, uid: true, source: false }
      )) {
        if (msg.uid <= this.lastSeenUid) continue;

        const from = msg.envelope.from?.[0]?.address || '';
        const subject = msg.envelope.subject || '';
        const date = msg.envelope.date;
        const platform = detectPlatform(from);

        if (platform) {
          const emailType = detectEmailType(subject);
          newMessages.push({
            uid: msg.uid,
            from,
            subject,
            date,
            platform,
            type: emailType,
            typeLabel: formatEmailType(emailType),
          });
        }

        this.lastSeenUid = Math.max(this.lastSeenUid, msg.uid);
      }

      if (newMessages.length > 0) {
        console.log(`[Gmail] ${newMessages.length} new platform email(s) for ${this.email}`);
        for (const email of newMessages) {
          try {
            await this.onNewEmail(this.pmId, email);
          } catch (err) {
            console.error(`[Gmail] Callback error: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`[Gmail] Poll error: ${err.message}`);
      // Connection might be stale, force reconnect on next poll
      this.connected = false;
      try { await this.client.logout(); } catch {}
    } finally {
      if (lock) lock.release();
    }
  }

  async fetchRecentPlatformEmails(count = 10) {
    if (!this.connected) await this.connect();

    let lock;
    const results = [];

    try {
      lock = await this.client.getMailboxLock('INBOX');

      // Search for recent emails from booking platforms
      const searchQuery = PLATFORM_SENDERS.airbnb
        .concat(PLATFORM_SENDERS.vrbo, PLATFORM_SENDERS.booking)
        .map(s => s.replace('@', ''))
        .join(' OR from:');

      // Get recent messages and filter
      let checked = 0;
      for await (const msg of this.client.fetch('1:*', { envelope: true, uid: true }, { changedSince: 0 })) {
        const from = msg.envelope.from?.[0]?.address || '';
        const platform = detectPlatform(from);
        if (platform) {
          results.unshift({
            uid: msg.uid,
            from,
            subject: msg.envelope.subject || '',
            date: msg.envelope.date,
            platform,
            type: detectEmailType(msg.envelope.subject || ''),
            typeLabel: formatEmailType(detectEmailType(msg.envelope.subject || '')),
          });
        }
        checked++;
        if (results.length >= count) break;
      }
    } finally {
      if (lock) lock.release();
    }

    return results.slice(0, count);
  }

  async readEmail(uid) {
    if (!this.connected) await this.connect();

    let lock;
    try {
      lock = await this.client.getMailboxLock('INBOX');
      const msg = await this.client.fetchOne(`${uid}`, { source: true, envelope: true });
      const { simpleParser } = require('mailparser');
      const parsed = await simpleParser(msg.source);
      return {
        from: parsed.from?.text || '',
        to: parsed.to?.text || '',
        subject: parsed.subject || '',
        date: parsed.date,
        text: parsed.text || '',
        html: parsed.html || '',
      };
    } finally {
      if (lock) lock.release();
    }
  }
}


module.exports = { GmailMonitor, detectPlatform, detectEmailType, formatEmailType };
