/**
 * Onboarding Flow — Conversational state machine for Telegram-first onboarding.
 *
 * Walks the PM through 6 steps entirely inside Telegram:
 * 1. Connect platforms (via Mini App for secure credential entry)
 * 2. Confirm properties & house rules
 * 3. Set communication style
 * 4. Configure escalation preferences
 * 5. Shadow mode (24-48h approval period)
 * 6. Go live
 *
 * State is stored per PM. Each step uses inline keyboards to guide choices.
 */

const { Markup } = require('telegraf');

// Onboarding states
const STATES = {
  START: 'start',
  CONNECT_PLATFORMS: 'connect_platforms',
  AWAITING_2FA: 'awaiting_2fa',
  CONFIRM_PROPERTIES: 'confirm_properties',
  HOUSE_RULES: 'house_rules',
  STYLE_SELECT: 'style_select',
  STYLE_FINE_TUNE: 'style_fine_tune',
  ESCALATION_PREFS: 'escalation_prefs',
  SHADOW_MODE: 'shadow_mode',
  LIVE: 'live',
};

class OnboardingFlow {
  constructor() {
    // pmId -> { state, data, step }
    this.sessions = new Map();
  }

  /**
   * Get or create an onboarding session for a PM.
   */
  getSession(pmId) {
    if (!this.sessions.has(pmId)) {
      this.sessions.set(pmId, {
        state: STATES.START,
        platforms: [],
        properties: [],
        houseRules: {},
        style: null,
        escalationRules: { useDefaults: true, overrides: [] },
        shadowMode: true,
        currentPropertyIndex: 0,
        pending2fa: null,
      });
    }
    return this.sessions.get(pmId);
  }

  /**
   * Start the onboarding flow.
   */
  async handleStart(ctx, pmId) {
    const session = this.getSession(pmId);
    session.state = STATES.START;

    await ctx.replyWithMarkdown(
      [
        `*Hey! I'm Alfred, your AI property manager.* I'll be handling guest messages, check-ins, and keeping you in the loop 24/7.`,
        '',
        `Let's get you set up -- takes about 10 minutes.`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback("Let's go!", 'onboard_start')],
        [Markup.button.callback('Tell me more first', 'onboard_info')],
      ])
    );
  }

  /**
   * Handle callback queries from inline keyboards.
   */
  async handleCallback(ctx, pmId, data) {
    const session = this.getSession(pmId);

    switch (data) {
      case 'onboard_start':
        return this.stepConnectPlatforms(ctx, pmId, session);

      case 'onboard_info':
        return this.showInfo(ctx, pmId);

      case 'connect_airbnb':
        return this.promptPlatformConnect(ctx, pmId, session, 'Airbnb');

      case 'connect_vrbo':
        return this.promptPlatformConnect(ctx, pmId, session, 'VRBO');

      case 'platforms_done':
        return this.stepConfirmProperties(ctx, pmId, session);

      case 'properties_correct':
        return this.stepHouseRules(ctx, pmId, session);

      case 'house_rules_done':
        return this.advanceProperty(ctx, pmId, session);

      case 'style_professional':
      case 'style_friendly':
      case 'style_casual':
      case 'style_luxury':
        return this.setStyle(ctx, pmId, session, data.replace('style_', ''));

      case 'style_examples':
        return this.showStyleExamples(ctx, pmId);

      case 'style_enough':
        return this.stepEscalationPrefs(ctx, pmId, session);

      case 'style_fine_tune':
        session.state = STATES.STYLE_FINE_TUNE;
        await ctx.replyWithMarkdown(
          `Tell me how you'd like to adjust. For example:\n` +
            `- "Use emoji sometimes"\n` +
            `- "Always offer early check-in"\n` +
            `- "Keep replies short"\n\n` +
            `Just type it out naturally.`
        );
        return;

      case 'escalation_defaults':
        return this.stepShadowMode(ctx, pmId, session);

      case 'escalation_customize':
        session.state = STATES.ESCALATION_PREFS;
        await ctx.replyWithMarkdown(
          `Tell me what you'd like to change. For example:\n` +
            `- "Don't bother me for early check-in requests"\n` +
            `- "Always escalate if guest mentions pets"\n` +
            `- "Alert me for any message after midnight"\n\n` +
            `Type your preferences and I'll save them.`
        );
        return;

      case 'shadow_start':
        return this.activateShadowMode(ctx, pmId, session);

      case 'go_live':
        return this.goLive(ctx, pmId, session);

      case 'keep_shadow':
        await ctx.replyWithMarkdown(
          `No problem -- I'll keep running in shadow mode. You'll keep seeing drafts for approval. Just say "go live" whenever you're ready.`
        );
        return;

      default:
        return;
    }
  }

  /**
   * Handle free-text messages during onboarding.
   */
  async handleText(ctx, pmId, text) {
    const session = this.getSession(pmId);

    switch (session.state) {
      case STATES.AWAITING_2FA:
        return this.handle2faCode(ctx, pmId, session, text);

      case STATES.HOUSE_RULES:
        return this.saveHouseRules(ctx, pmId, session, text);

      case STATES.STYLE_FINE_TUNE:
        return this.saveStyleTweaks(ctx, pmId, session, text);

      case STATES.ESCALATION_PREFS:
        return this.saveEscalationOverrides(ctx, pmId, session, text);

      default:
        return false; // Not handled by onboarding
    }
  }

  /**
   * Check if this PM is currently onboarding.
   */
  isOnboarding(pmId) {
    const session = this.sessions.get(pmId);
    return session && session.state !== STATES.LIVE;
  }

  // ===========================================================================
  // Step implementations
  // ===========================================================================

  async showInfo(ctx, pmId) {
    await ctx.replyWithMarkdown(
      [
        `*Here's what I do:*`,
        '',
        `- Read and reply to guest messages on Airbnb & VRBO`,
        `- Match your communication style so guests can't tell the difference`,
        `- Send you a daily briefing every morning`,
        `- Alert you instantly for anything urgent (safety, refunds, angry guests)`,
        `- Run 24/7 -- I never sleep`,
        '',
        `*Your credentials are encrypted with AES-256 and never visible to anyone.*`,
        `I use them only to maintain a browser session on your behalf.`,
        '',
        `Ready to get started?`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback("Let's go!", 'onboard_start')],
      ])
    );
  }

  async stepConnectPlatforms(ctx, pmId, session) {
    session.state = STATES.CONNECT_PLATFORMS;

    const miniAppBase = process.env.MINI_APP_URL || 'https://yourdomain.com/onboarding';

    await ctx.replyWithMarkdown(
      [
        `*Step 1: Connect Your Platforms*`,
        '',
        `I need access to your booking platforms so I can read and reply to guest messages.`,
        '',
        `Tap below to securely connect each one. Your passwords are encrypted and never visible to anyone -- not even me.`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.webApp('Connect Airbnb', `${miniAppBase}/credential-form.html?platform=airbnb&pm=${pmId}`)],
        [Markup.button.webApp('Connect VRBO', `${miniAppBase}/credential-form.html?platform=vrbo&pm=${pmId}`)],
        [Markup.button.callback("I'm done connecting", 'platforms_done')],
      ])
    );
  }

  async promptPlatformConnect(ctx, pmId, session, platform) {
    session.platforms.push(platform.toLowerCase());
    await ctx.replyWithMarkdown(
      `Connecting to ${platform}... I'll check your inbox to verify the connection.`
    );
  }

  async handle2faCode(ctx, pmId, session, text) {
    const code = text.trim().replace(/\s/g, '');
    if (!/^\d{4,8}$/.test(code)) {
      await ctx.reply('That doesn\'t look like a verification code. Please enter just the numbers.');
      return;
    }

    const platform = session.pending2fa;
    session.pending2fa = null;
    session.state = STATES.CONNECT_PLATFORMS;

    await ctx.reply(`Submitting code for ${platform}...`);

    // The actual code submission happens via the server's auth code relay
    // This just captures the code and routes it
    return { type: 'auth_code', platform, code };
  }

  async stepConfirmProperties(ctx, pmId, session) {
    session.state = STATES.CONFIRM_PROPERTIES;

    // In production, this would fetch real properties from browser automation
    // For now, prompt the PM to list them
    if (session.properties.length === 0) {
      await ctx.replyWithMarkdown(
        [
          `*Step 2: Your Properties*`,
          '',
          `How many properties do you manage? Just tell me the names and I'll set them up.`,
          '',
          `For example: "I have 3 -- Lakeside Cottage in Kelowna, Downtown Loft in Vancouver, and Mountain Cabin in Whistler"`,
        ].join('\n')
      );
      session.state = STATES.CONFIRM_PROPERTIES;
      return;
    }

    // If properties were auto-detected
    const propList = session.properties
      .map((p, i) => `  ${i + 1}. ${p.name} -- ${p.location}`)
      .join('\n');

    await ctx.replyWithMarkdown(
      [
        `I found these properties:`,
        propList,
        '',
        `Is that right?`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('Yes, that\'s all of them', 'properties_correct')],
        [Markup.button.callback('I have more', 'properties_add')],
      ])
    );
  }

  async stepHouseRules(ctx, pmId, session) {
    session.state = STATES.HOUSE_RULES;
    session.currentPropertyIndex = 0;
    return this.promptHouseRulesForProperty(ctx, pmId, session);
  }

  async promptHouseRulesForProperty(ctx, pmId, session) {
    const prop = session.properties[session.currentPropertyIndex];
    if (!prop) {
      return this.stepStyleSelect(ctx, pmId, session);
    }

    await ctx.replyWithMarkdown(
      [
        `*House Rules for ${prop.name}*`,
        '',
        `Any special rules or instructions I should know? Things like:`,
        `- WiFi password, lockbox/door code`,
        `- Parking info`,
        `- Quiet hours, pet policy`,
        `- Check-in / check-out procedures`,
        '',
        `Just type them out naturally -- I'll organize them.`,
      ].join('\n')
    );
  }

  async saveHouseRules(ctx, pmId, session, text) {
    const prop = session.properties[session.currentPropertyIndex];
    if (!prop) return;

    session.houseRules[prop.name] = text;

    await ctx.replyWithMarkdown(
      `Got it! House rules saved for *${prop.name}*.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Looks good', 'house_rules_done')],
      ])
    );
  }

  async advanceProperty(ctx, pmId, session) {
    session.currentPropertyIndex++;
    if (session.currentPropertyIndex < session.properties.length) {
      return this.promptHouseRulesForProperty(ctx, pmId, session);
    }
    return this.stepStyleSelect(ctx, pmId, session);
  }

  async stepStyleSelect(ctx, pmId, session) {
    session.state = STATES.STYLE_SELECT;

    await ctx.replyWithMarkdown(
      [
        `*Step 3: Your Communication Style*`,
        '',
        `How do you usually talk to guests? This helps me match your tone so guests can't tell the difference.`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('Professional & formal', 'style_professional')],
        [Markup.button.callback('Warm & friendly', 'style_friendly')],
        [Markup.button.callback('Casual & fun', 'style_casual')],
        [Markup.button.callback('Luxury concierge', 'style_luxury')],
        [Markup.button.callback('Show me examples', 'style_examples')],
      ])
    );
  }

  async showStyleExamples(ctx, pmId) {
    await ctx.replyWithMarkdown(
      [
        `Here's how I'd reply to "What time is check-in?" in each style:`,
        '',
        `*Professional:* "Check-in is at 3:00 PM. Please let me know if you need to arrange early check-in."`,
        '',
        `*Friendly:* "Hey! Check-in starts at 3 PM. If you're arriving earlier, just let me know and I'll see what I can do!"`,
        '',
        `*Casual:* "Yo! 3pm for check-in. Hit me up if you need to get in earlier tho"`,
        '',
        `*Luxury:* "Welcome. Check-in begins at 3:00 PM, and our personalized guide will be sent prior to your arrival. We are at your service."`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('Professional', 'style_professional')],
        [Markup.button.callback('Friendly', 'style_friendly')],
        [Markup.button.callback('Casual', 'style_casual')],
        [Markup.button.callback('Luxury', 'style_luxury')],
      ])
    );
  }

  async setStyle(ctx, pmId, session, style) {
    session.style = style;

    await ctx.replyWithMarkdown(
      `Style set to *${style}*. Want to fine-tune it more?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Fine-tune it', 'style_fine_tune')],
        [Markup.button.callback('This is enough', 'style_enough')],
      ])
    );
  }

  async saveStyleTweaks(ctx, pmId, session, text) {
    if (!session.styleTweaks) session.styleTweaks = [];
    session.styleTweaks.push(text);
    session.state = STATES.STYLE_SELECT;

    await ctx.replyWithMarkdown(
      `Noted! I'll incorporate that. Anything else?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Add more', 'style_fine_tune')],
        [Markup.button.callback("That's it", 'style_enough')],
      ])
    );
  }

  async stepEscalationPrefs(ctx, pmId, session) {
    session.state = STATES.ESCALATION_PREFS;

    await ctx.replyWithMarkdown(
      [
        `*Step 4: When Should I Bother You?*`,
        '',
        `I'll always handle these myself:`,
        `  - Check-in/checkout questions`,
        `  - WiFi/lockbox/parking info`,
        `  - Basic booking inquiries`,
        `  - Review responses`,
        '',
        `I'll alert you immediately for:`,
        `  - Safety issues or property damage`,
        `  - Guest wants a refund`,
        `  - Angry or threatening guests`,
        `  - Maintenance emergencies`,
        '',
        `Want to adjust any of these?`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('Looks perfect', 'escalation_defaults')],
        [Markup.button.callback('Customize', 'escalation_customize')],
      ])
    );
  }

  async saveEscalationOverrides(ctx, pmId, session, text) {
    session.escalationRules.overrides.push(text);
    session.state = STATES.ESCALATION_PREFS;

    await ctx.replyWithMarkdown(
      `Saved! Anything else to adjust?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Add more rules', 'escalation_customize')],
        [Markup.button.callback("That's all", 'escalation_defaults')],
      ])
    );
  }

  async stepShadowMode(ctx, pmId, session) {
    session.state = STATES.SHADOW_MODE;

    await ctx.replyWithMarkdown(
      [
        `*All set! I'm now monitoring your listings.*`,
        '',
        `For the first 24-48 hours, I'll run in *Shadow Mode*:`,
        `- I'll draft replies to every guest message`,
        `- I'll send them to you here for approval first`,
        `- I won't send anything to guests until you say so`,
        '',
        `This lets you see how I handle things before going fully autonomous.`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('Start shadow mode', 'shadow_start')],
        [Markup.button.callback('I have questions first', 'onboard_info')],
      ])
    );
  }

  async activateShadowMode(ctx, pmId, session) {
    session.shadowMode = true;
    session.state = STATES.SHADOW_MODE;
    session.shadowStartedAt = new Date().toISOString();

    await ctx.replyWithMarkdown(
      [
        `Shadow mode is *active*. I'm watching your inboxes now.`,
        '',
        `When a guest message comes in, I'll send you my draft reply here. You can:`,
        `- Reply "approve" to send it`,
        `- Type a revised message to send instead`,
        `- Reply "skip" to handle it yourself`,
        '',
        `I'll keep learning from your edits.`,
      ].join('\n')
    );

    return { type: 'shadow_mode_activated', session };
  }

  async goLive(ctx, pmId, session) {
    session.state = STATES.LIVE;
    session.shadowMode = false;
    session.liveAt = new Date().toISOString();

    await ctx.replyWithMarkdown(
      [
        `*You're live!* I'm now handling guest messages autonomously.`,
        '',
        `You'll still get:`,
        `- Daily morning briefing`,
        `- Instant alerts for escalations`,
        `- Weekly performance report`,
        '',
        `Commands:`,
        `/briefing -- Today's summary`,
        `/pause -- Emergency stop`,
        `/style -- Adjust my tone`,
        '',
        `Or just message me anytime -- I'm here 24/7.`,
      ].join('\n')
    );

    return { type: 'onboarding_complete', session };
  }

  /**
   * Export the completed onboarding data for Paperclip company creation.
   */
  exportConfig(pmId) {
    const session = this.sessions.get(pmId);
    if (!session) return null;

    return {
      platforms: session.platforms,
      properties: session.properties,
      houseRules: session.houseRules,
      style: {
        preset: session.style,
        tweaks: session.styleTweaks || [],
      },
      escalation: session.escalationRules,
      shadowMode: session.shadowMode,
    };
  }
}

module.exports = { OnboardingFlow, STATES };
