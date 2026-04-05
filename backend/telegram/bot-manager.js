/**
 * Telegram Bot Manager
 *
 * Manages one bot per property manager. All PM communication flows through
 * Telegram — briefings, escalations, 2FA relay, reports, and free-text chat
 * with their CEO agent.
 */

const { Telegraf } = require('telegraf');

const BOT_POOL = (process.env.TELEGRAM_BOT_TOKENS || '').split(',').filter(Boolean);
const WEBHOOK_BASE = process.env.TELEGRAM_WEBHOOK_BASE || 'https://yourdomain.com/api/telegram';

class BotManager {
  constructor() {
    // pm_id -> { bot, token, chatId }
    this.activeBots = new Map();
    // Available unassigned tokens
    this.availableTokens = [...BOT_POOL];
    // Callback for when PM sends a message
    this.onPmMessage = null;
  }

  /**
   * Assign a bot from the pool to a property manager.
   * Returns the bot token and a deep link for the PM to start the chat.
   */
  assignBot(pmId) {
    if (this.activeBots.has(pmId)) {
      const existing = this.activeBots.get(pmId);
      return {
        token: existing.token,
        deepLink: `https://t.me/${existing.bot.botInfo?.username}?start=${pmId}`,
      };
    }

    if (this.availableTokens.length === 0) {
      throw new Error('No available Telegram bots in pool. Create more via BotFather.');
    }

    const token = this.availableTokens.shift();
    const bot = new Telegraf(token);

    this._setupCommands(bot, pmId);

    this.activeBots.set(pmId, { bot, token, chatId: null });

    return {
      token,
      deepLink: `https://t.me/Host4Me_bot?start=${pmId}`,
      poolRemaining: this.availableTokens.length,
    };
  }

  /**
   * Start all assigned bots.
   * Uses polling mode if TELEGRAM_WEBHOOK_BASE is not set or is a placeholder.
   * Uses webhook mode for production with HTTPS.
   */
  async startAll() {
    const usePolling = !WEBHOOK_BASE || WEBHOOK_BASE.includes('yourdomain.com') || WEBHOOK_BASE.startsWith('http://');

    // Auto-assign first bot if pool has tokens and no bots assigned yet
    if (this.activeBots.size === 0 && this.availableTokens.length > 0) {
      this.assignBot('default');
      console.log('Auto-assigned first bot to default PM');
    }

    for (const [pmId, entry] of this.activeBots) {
      try {
        if (usePolling) {
          // Delete any existing webhook first
          await entry.bot.telegram.deleteWebhook();
          // Launch in polling mode
          entry.bot.launch();
          console.log(`Bot for PM ${pmId} started in polling mode`);
        } else {
          const webhookUrl = `${WEBHOOK_BASE}/${pmId}`;
          await entry.bot.telegram.setWebhook(webhookUrl);
          console.log(`Bot for PM ${pmId} webhook set: ${webhookUrl}`);
        }
      } catch (err) {
        console.error(`Failed to start bot for PM ${pmId}:`, err.message);
      }
    }
  }

  /**
   * Handle incoming webhook update for a specific PM's bot.
   */
  async handleWebhook(pmId, update) {
    const entry = this.activeBots.get(pmId);
    if (!entry) return;
    await entry.bot.handleUpdate(update);
  }

  /**
   * Send a message to a PM via their Telegram bot.
   */
  async sendMessage(pmId, text, options = {}) {
    const entry = this.activeBots.get(pmId);
    if (!entry || !entry.chatId) {
      console.warn(`Cannot send to PM ${pmId}: no active chat`);
      return false;
    }

    try {
      await entry.bot.telegram.sendMessage(entry.chatId, text, {
        parse_mode: 'Markdown',
        ...options,
      });
      return true;
    } catch (err) {
      console.error(`Failed to send message to PM ${pmId}:`, err.message);
      return false;
    }
  }

  /**
   * Send an escalation notification.
   */
  async sendEscalation(pmId, escalation) {
    const emoji = { urgent: '🔴', action: '🟡', info: '🟢' }[escalation.level] || '🟡';

    const text = [
      `${emoji} *ESCALATION — ${escalation.property}*`,
      '',
      `*Guest:* ${escalation.guestName}`,
      `*Platform:* ${escalation.platform}`,
      `*Booking:* ${escalation.checkIn} → ${escalation.checkOut}`,
      '',
      `*Issue:* ${escalation.summary}`,
      '',
      `*Context:* ${escalation.context}`,
      '',
      `*Recommended Action:* ${escalation.recommendation}`,
      '',
      '_Reply with instructions, or type /resolve to close._',
    ].join('\n');

    return this.sendMessage(pmId, text);
  }

  /**
   * Send a daily briefing.
   */
  async sendBriefing(pmId, briefing) {
    const text = [
      `🟢 *Daily Briefing — ${briefing.date}*`,
      '',
      `📨 *Messages:* ${briefing.messagesReceived} received, ${briefing.messagesReplied} replied`,
      `⏱ *Avg Response Time:* ${briefing.avgResponseTime}`,
      `🏠 *Bookings:* ${briefing.newBookings} new, ${briefing.checkInsToday} check-ins today`,
      `📊 *Sentiment:* ${briefing.sentimentPositive}% positive`,
      '',
      briefing.escalations > 0
        ? `🟡 *${briefing.escalations} open escalation(s)* — type /escalations to review`
        : '✅ No open escalations',
      '',
      briefing.issues.length > 0
        ? `⚠️ *Issues:*\n${briefing.issues.map((i) => `  • ${i}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.sendMessage(pmId, text);
  }

  /**
   * Send a 2FA code request to the PM.
   */
  async requestAuthCode(pmId, platform, details) {
    const text = [
      `🟡 *Authentication Required — ${platform}*`,
      '',
      `${details}`,
      '',
      `Please send the verification code using:`,
      `\`/auth ${platform} YOUR_CODE\``,
    ].join('\n');

    return this.sendMessage(pmId, text);
  }

  /**
   * Set up bot commands for a PM's bot.
   */
  _setupCommands(bot, pmId) {
    // /start — Initial setup, capture chat ID
    bot.start((ctx) => {
      const entry = this.activeBots.get(pmId);
      if (entry) {
        entry.chatId = ctx.chat.id;
      }

      ctx.replyWithMarkdown(
        [
          `👋 *Welcome to Host4Me!*`,
          '',
          `I'm Alfred, your AI property management assistant.`,
          `I'll handle your guest messages, send you daily briefings, and alert you when something needs your attention.`,
          '',
          `*Available commands:*`,
          `/briefing — Today's summary`,
          `/listings — Status of all properties`,
          `/escalations — Pending items needing attention`,
          `/report — On-demand analytics`,
          `/style — Adjust communication preferences`,
          `/pause — Pause auto-replies (emergency)`,
          `/resume — Resume auto-replies`,
          `/auth [platform] [code] — Submit a 2FA code`,
          '',
          `Or just send me a message and I'll understand! 🤖`,
        ].join('\n'),
      );
    });

    // /briefing
    bot.command('briefing', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'briefing' });
      }
      ctx.reply('📊 Generating your briefing...');
    });

    // /listings
    bot.command('listings', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'listings' });
      }
      ctx.reply('🏠 Checking listing status...');
    });

    // /escalations
    bot.command('escalations', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'escalations' });
      }
      ctx.reply('🔍 Checking open escalations...');
    });

    // /report
    bot.command('report', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'report' });
      }
      ctx.reply('📊 Generating report...');
    });

    // /pause
    bot.command('pause', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'pause' });
      }
      ctx.reply('⏸ Auto-replies paused. Type /resume to restart.');
    });

    // /resume
    bot.command('resume', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'resume' });
      }
      ctx.reply('▶️ Auto-replies resumed.');
    });

    // /style
    bot.command('style', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'style' });
      }
      ctx.replyWithMarkdown(
        [
          '*Current style presets:*',
          '• Professional',
          '• Friendly',
          '• Casual',
          '• Luxury',
          '',
          'To change, say something like "be more casual" or "use a luxury tone".',
        ].join('\n'),
      );
    });

    // /auth [platform] [code]
    bot.command('auth', async (ctx) => {
      const parts = ctx.message.text.split(' ').slice(1);
      if (parts.length < 2) {
        ctx.reply('Usage: /auth airbnb 123456');
        return;
      }
      const [platform, code] = parts;
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'auth_code', { platform, code });
      }
      ctx.reply(`🔐 Submitting code for ${platform}...`);
    });

    // /resolve
    bot.command('resolve', async (ctx) => {
      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'command', { command: 'resolve' });
      }
      ctx.reply('✅ Escalation resolved. Auto-replies resumed for that thread.');
    });

    // Free text — Route to CEO agent
    bot.on('text', async (ctx) => {
      const entry = this.activeBots.get(pmId);
      if (entry && !entry.chatId) {
        entry.chatId = ctx.chat.id;
      }

      if (this.onPmMessage) {
        await this.onPmMessage(pmId, 'text', { text: ctx.message.text });
      }
    });
  }

  /**
   * Get pool status.
   */
  getStatus() {
    return {
      activeBots: this.activeBots.size,
      availableTokens: this.availableTokens.length,
      pms: [...this.activeBots.keys()],
    };
  }
}

module.exports = { BotManager };
