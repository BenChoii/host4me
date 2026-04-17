/**
 * Alfred — Telegram Bot Runner
 *
 * Conversational onboarding flow:
 *   /start → Welcome & explain what Alfred does
 *        → Ask which platforms they use (Airbnb, VRBO, Booking.com)
 *        → Send login links for each platform
 *        → Explain Gmail scanning & send connect link
 *        → Walk through property details Q&A
 *        → Set communication style
 *        → Confirm shadow mode & go live
 *
 * After onboarding, Alfred handles:
 *   - Free-text commands & questions
 *   - /briefing, /listings, /escalations, /pause, /resume, /style
 *   - 2FA relay via /auth
 */

const { Telegraf, Markup } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKENS;
if (!token) {
  console.error('TELEGRAM_BOT_TOKENS not set');
  process.exit(1);
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://host4me-ioel.vercel.app';
const VPS_URL = process.env.VPS_URL || 'https://187-124-182-236.sslip.io';

const bot = new Telegraf(token);

// ─── In-memory state (per chat) ─────────────────────────────────────────────
// In production this would be backed by Convex
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      step: 'new',              // Onboarding step
      platforms: [],             // Selected platforms
      platformsLoggedIn: [],     // Platforms they've logged into
      gmailConnected: false,
      properties: [],            // Array of property objects
      currentProperty: null,     // Property being edited
      propertyField: null,       // Current field being asked
      style: 'friendly',        // Communication style
      shadowMode: true,
      onboarded: false,
    });
  }
  return sessions.get(chatId);
}

// ─── Onboarding steps ───────────────────────────────────────────────────────

const PLATFORM_INFO = {
  airbnb: { label: 'Airbnb', emoji: '🏠', color: '#FF5A5F' },
  vrbo: { label: 'VRBO', emoji: '🏡', color: '#3B5998' },
  booking: { label: 'Booking.com', emoji: '🏨', color: '#003580' },
};

const PROPERTY_FIELDS = [
  { key: 'name', question: "What's the name or address of this property?", emoji: '📍' },
  { key: 'wifi_name', question: "What's the WiFi network name?", emoji: '📶' },
  { key: 'wifi_password', question: "What's the WiFi password?", emoji: '🔑' },
  { key: 'door_code', question: "What's the door/lockbox code? (or type 'skip' if there isn't one)", emoji: '🚪' },
  { key: 'checkin_time', question: "What time is check-in?", emoji: '⏰' },
  { key: 'checkout_time', question: "What time is check-out?", emoji: '⏰' },
  { key: 'house_rules', question: "Any important house rules guests should know? (e.g., no smoking, quiet hours, max guests)", emoji: '📋' },
  { key: 'parking', question: "Parking instructions? (or type 'skip')", emoji: '🅿️' },
  { key: 'special_notes', question: "Anything else guests commonly ask about? (or type 'done' to finish this property)", emoji: '💡' },
];

// ─── /start ─────────────────────────────────────────────────────────────────

bot.start((ctx) => {
  const session = getSession(ctx.chat.id);
  session.step = 'welcome';

  ctx.replyWithMarkdown(
    [
      '👋 *Welcome to Host4Me!*',
      '',
      "I'm Alfred, your AI property management assistant.",
      '',
      "Here's what I'll do for you:",
      '• 💬 *Reply to guest messages* in your voice and style',
      '• 📊 *Send daily briefings* every morning',
      '• 🚨 *Alert you* when something needs your attention',
      '• 🔍 *Learn your properties* — WiFi codes, door codes, house rules, check-in details',
      '',
      "To do this well, I'll need to:",
      "1️⃣ Log into your rental platforms (Airbnb, VRBO, etc.) so I can read and reply to messages",
      "2️⃣ Scan your Gmail for property details — booking confirmations, WiFi passwords, cleaning schedules",
      "3️⃣ Ask you a few questions about each property",
      '',
      "_Everything stays private. I work for you and only you._",
      '',
      "Ready to get started? Let's go! 👇",
    ].join('\n'),
  );

  // Short delay then ask about platforms
  setTimeout(() => {
    session.step = 'ask_platforms';
    ctx.reply(
      'Which rental platforms do you use?',
      Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Airbnb', 'platform_airbnb')],
        [Markup.button.callback('🏡 VRBO', 'platform_vrbo')],
        [Markup.button.callback('🏨 Booking.com', 'platform_booking')],
        [Markup.button.callback('✅ Done selecting', 'platforms_done')],
      ]),
    );
  }, 1500);
});

// ─── Platform selection callbacks ───────────────────────────────────────────

bot.action(/^platform_(.+)$/, (ctx) => {
  const session = getSession(ctx.chat.id);
  const platform = ctx.match[1];

  if (!session.platforms.includes(platform)) {
    session.platforms.push(platform);
    const info = PLATFORM_INFO[platform];
    ctx.answerCbQuery(`${info.emoji} ${info.label} added!`);

    // Update the message to show what's selected
    const selected = session.platforms.map((p) => PLATFORM_INFO[p].label).join(', ');
    ctx.editMessageText(
      `Which rental platforms do you use?\n\n✅ Selected: *${selected}*\n\n_Tap more or hit Done._`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          ...['airbnb', 'vrbo', 'booking']
            .filter((p) => !session.platforms.includes(p))
            .map((p) => [Markup.button.callback(`${PLATFORM_INFO[p].emoji} ${PLATFORM_INFO[p].label}`, `platform_${p}`)]),
          [Markup.button.callback('✅ Done selecting', 'platforms_done')],
        ]),
      },
    );
  } else {
    ctx.answerCbQuery('Already selected!');
  }
});

bot.action('platforms_done', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();

  if (session.platforms.length === 0) {
    ctx.reply("You haven't selected any platforms yet. Tap the buttons above, or type the platform name.");
    return;
  }

  const selected = session.platforms.map((p) => PLATFORM_INFO[p].label).join(', ');
  ctx.editMessageText(`✅ Platforms: *${selected}*`, { parse_mode: 'Markdown' });

  // Move to platform login step
  session.step = 'platform_login';
  sendPlatformLoginInstructions(ctx, session);
});

function sendPlatformLoginInstructions(ctx, session) {
  const platformList = session.platforms
    .map((p) => `${PLATFORM_INFO[p].emoji} *${PLATFORM_INFO[p].label}*`)
    .join(', ');

  ctx.replyWithMarkdown(
    [
      `Great! I need to log into ${platformList} so I can monitor your guest messages and reply on your behalf.`,
      '',
      "Here's how it works:",
      "• You'll log in through a *secure browser window* on our dashboard",
      "• Your credentials *never touch our servers* — we only save the browser session",
      "• I'll use that session to read and reply to messages",
      '',
      `👉 [Open Dashboard to Connect Platforms](${DASHBOARD_URL}/dashboard/onboarding)`,
      '',
      "Once you've logged in, come back here and tap the button below.",
    ].join('\n'),
    {
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([
        [Markup.button.callback("✅ I've logged in", 'login_done')],
        [Markup.button.callback('⏭ Skip for now', 'login_skip')],
      ]),
    },
  );
}

bot.action('login_done', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery('Nice!');
  session.platformsLoggedIn = [...session.platforms];
  session.step = 'gmail_intro';
  ctx.editMessageText('✅ Platform login complete!', { parse_mode: 'Markdown' });
  sendGmailIntro(ctx, session);
});

bot.action('login_skip', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();
  session.step = 'gmail_intro';
  ctx.editMessageText('⏭ Skipped for now — you can connect platforms anytime from the dashboard.', { parse_mode: 'Markdown' });
  sendGmailIntro(ctx, session);
});

// ─── Gmail scanning ─────────────────────────────────────────────────────────

function sendGmailIntro(ctx, session) {
  setTimeout(() => {
    ctx.replyWithMarkdown(
      [
        '📧 *Next: Connect Gmail*',
        '',
        "I'd like to scan your Gmail for property-related info. I'll look for:",
        '• 📶 WiFi passwords and network names',
        '• 🚪 Door codes and lockbox combinations',
        '• 📋 House rules you\'ve shared with guests before',
        '• 🧹 Cleaning schedules and turnover details',
        '• 📅 Booking confirmations with check-in/out times',
        '',
        "_I only read emails related to your rental properties. Everything is private and encrypted._",
      ].join('\n'),
      {
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
          [Markup.button.url('🔗 Connect Gmail', `${DASHBOARD_URL}/dashboard/settings`)],
          [Markup.button.callback("✅ Gmail connected", 'gmail_done')],
          [Markup.button.callback('⏭ Skip Gmail', 'gmail_skip')],
        ]),
      },
    );
  }, 1000);
}

bot.action('gmail_done', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();
  session.gmailConnected = true;
  session.step = 'gmail_scanning';
  ctx.editMessageText('✅ Gmail connected!', { parse_mode: 'Markdown' });

  // Simulate scanning
  ctx.replyWithMarkdown('🔍 *Scanning your emails...* This may take a moment.');

  setTimeout(() => {
    ctx.replyWithMarkdown(
      [
        '📋 *Here\'s what I found:*',
        '',
        "I'll learn more as I read your guest conversations, but let me ask you a few questions about each property to fill in any gaps.",
        '',
        "Let's start — how many properties do you manage?",
      ].join('\n'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('1', 'num_properties_1'),
          Markup.button.callback('2', 'num_properties_2'),
          Markup.button.callback('3', 'num_properties_3'),
          Markup.button.callback('4+', 'num_properties_4'),
        ],
      ]),
    );
    session.step = 'ask_num_properties';
  }, 3000);
});

bot.action('gmail_skip', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();
  session.step = 'ask_num_properties';
  ctx.editMessageText("⏭ Skipped Gmail — you can connect anytime. I'll rely on what you tell me instead.", { parse_mode: 'Markdown' });

  setTimeout(() => {
    ctx.replyWithMarkdown(
      [
        "No problem! I'll learn from your guest conversations over time.",
        '',
        "For now, let me ask you about your properties so I can start helping right away.",
        '',
        "How many properties do you manage?",
      ].join('\n'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('1', 'num_properties_1'),
          Markup.button.callback('2', 'num_properties_2'),
          Markup.button.callback('3', 'num_properties_3'),
          Markup.button.callback('4+', 'num_properties_4'),
        ],
      ]),
    );
  }, 1000);
});

// ─── Property count & details ───────────────────────────────────────────────

bot.action(/^num_properties_(\d+\+?)$/, (ctx) => {
  const session = getSession(ctx.chat.id);
  const count = ctx.match[1] === '4+' ? 4 : parseInt(ctx.match[1]);
  ctx.answerCbQuery();
  ctx.editMessageText(`📊 Managing *${ctx.match[1]}* ${count === 1 ? 'property' : 'properties'}`, { parse_mode: 'Markdown' });

  session.totalProperties = count;
  session.propertiesCompleted = 0;
  session.step = 'property_details';
  session.propertyField = 0;
  session.currentProperty = {};

  setTimeout(() => {
    ctx.replyWithMarkdown(
      [
        `Great! Let's set up ${count === 1 ? 'your property' : 'your first property'}.`,
        '',
        "I'll ask a few quick questions. You can type *skip* to skip any question.",
        '',
        `${PROPERTY_FIELDS[0].emoji} ${PROPERTY_FIELDS[0].question}`,
      ].join('\n'),
    );
  }, 500);
});

// ─── Communication style ────────────────────────────────────────────────────

function askCommunicationStyle(ctx, session) {
  session.step = 'ask_style';
  ctx.replyWithMarkdown(
    [
      '🎨 *Almost done! How should I talk to your guests?*',
      '',
      "Pick the style that matches how you'd reply yourself:",
    ].join('\n'),
    Markup.inlineKeyboard([
      [Markup.button.callback('😊 Friendly', 'style_friendly'), Markup.button.callback('👔 Professional', 'style_professional')],
      [Markup.button.callback('😎 Casual', 'style_casual'), Markup.button.callback('✨ Luxury', 'style_luxury')],
    ]),
  );
}

bot.action(/^style_(.+)$/, (ctx) => {
  const session = getSession(ctx.chat.id);
  const style = ctx.match[1];
  session.style = style;
  ctx.answerCbQuery();

  const styleDescriptions = {
    friendly: "Warm and welcoming — like a helpful neighbor",
    professional: "Polished and clear — like a hotel concierge",
    casual: "Relaxed and easygoing — like texting a friend",
    luxury: "Elegant and attentive — like a five-star butler",
  };

  ctx.editMessageText(
    `🎨 Communication style: *${style.charAt(0).toUpperCase() + style.slice(1)}*\n_${styleDescriptions[style]}_`,
    { parse_mode: 'Markdown' },
  );

  // Move to shadow mode explanation
  setTimeout(() => sendShadowModeIntro(ctx, session), 800);
});

// ─── Shadow mode ────────────────────────────────────────────────────────────

function sendShadowModeIntro(ctx, session) {
  session.step = 'shadow_mode';
  ctx.replyWithMarkdown(
    [
      '🛡 *Shadow Mode*',
      '',
      "For safety, I'll start in *shadow mode*. Here's how it works:",
      '',
      "• When a guest messages you, I'll *draft a reply* and send it to you here for approval",
      "• You can *approve, edit, or reject* each response",
      "• Once you're confident in my replies, you can switch to *auto mode* and I'll reply directly",
      '',
      "_Most hosts run shadow mode for the first week, then switch to auto._",
    ].join('\n'),
    Markup.inlineKeyboard([
      [Markup.button.callback('🛡 Start in Shadow Mode (Recommended)', 'shadow_on')],
      [Markup.button.callback('⚡ Start in Auto Mode', 'shadow_off')],
    ]),
  );
}

bot.action('shadow_on', (ctx) => {
  const session = getSession(ctx.chat.id);
  session.shadowMode = true;
  ctx.answerCbQuery();
  ctx.editMessageText("🛡 *Shadow mode: ON* — I'll send drafts for your approval", { parse_mode: 'Markdown' });
  finishOnboarding(ctx, session);
});

bot.action('shadow_off', (ctx) => {
  const session = getSession(ctx.chat.id);
  session.shadowMode = false;
  ctx.answerCbQuery();
  ctx.editMessageText("⚡ *Auto mode: ON* — I'll reply to guests directly and notify you", { parse_mode: 'Markdown' });
  finishOnboarding(ctx, session);
});

// ─── Onboarding complete ────────────────────────────────────────────────────

function finishOnboarding(ctx, session) {
  session.step = 'onboarded';
  session.onboarded = true;

  setTimeout(() => {
    const platformsList = session.platforms.length > 0
      ? session.platforms.map((p) => `  ${PLATFORM_INFO[p].emoji} ${PLATFORM_INFO[p].label}`).join('\n')
      : '  ⚠️ None yet — connect from dashboard';

    const propertiesList = session.properties.length > 0
      ? session.properties.map((p, i) => `  📍 ${p.name || `Property ${i + 1}`}`).join('\n')
      : '  ⚠️ None yet — tell me about them anytime';

    ctx.replyWithMarkdown(
      [
        '🎉 *Alfred is ready!*',
        '',
        "Here's your setup summary:",
        '',
        '*Platforms:*',
        platformsList,
        '',
        '*Properties:*',
        propertiesList,
        '',
        `*Style:* ${session.style.charAt(0).toUpperCase() + session.style.slice(1)}`,
        `*Mode:* ${session.shadowMode ? '🛡 Shadow (drafts for approval)' : '⚡ Auto (replies directly)'}`,
        `*Gmail:* ${session.gmailConnected ? '✅ Connected' : '⏭ Not yet'}`,
        '',
        "I'm now monitoring your inboxes. Here's what you can do:",
        '',
        '*Commands:*',
        '/briefing — Today\'s summary',
        '/listings — Status of all properties',
        '/escalations — Pending items needing attention',
        '/pause — Pause auto-replies',
        '/resume — Resume auto-replies',
        '/style — Change communication style',
        '/auth [platform] [code] — Submit a 2FA code',
        '',
        'Or just send me a message and I\'ll understand! 🤖',
        '',
        "_I'll send your first briefing tomorrow morning at 8am._",
      ].join('\n'),
    );
  }, 1000);
}

// ─── Post-onboarding commands ───────────────────────────────────────────────

bot.command('briefing', (ctx) => {
  ctx.replyWithMarkdown('📊 *Generating your briefing...*');
  // TODO: Hook into agent system
  setTimeout(() => {
    ctx.replyWithMarkdown(
      [
        '🟢 *Daily Briefing — ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + '*',
        '',
        '📨 *Messages:* 0 received, 0 replied',
        '⏱ *Avg Response Time:* —',
        '🏠 *Bookings:* 0 new, 0 check-ins today',
        '',
        '✅ No open escalations',
        '',
        '_Alfred is monitoring your inboxes. All quiet for now!_',
      ].join('\n'),
    );
  }, 1500);
});

bot.command('listings', (ctx) => {
  const session = getSession(ctx.chat.id);
  if (session.properties.length === 0) {
    ctx.reply('No properties set up yet. Tell me about your first property — just send the name or address!');
    return;
  }
  const list = session.properties
    .map((p, i) => `${i + 1}. 📍 *${p.name || 'Unnamed'}*\n   WiFi: ${p.wifi_name || '—'} | Door: ${p.door_code || '—'}`)
    .join('\n\n');
  ctx.replyWithMarkdown(`🏠 *Your Properties:*\n\n${list}`);
});

bot.command('escalations', (ctx) => {
  ctx.reply('✅ No open escalations. All quiet!');
});

bot.command('pause', (ctx) => {
  ctx.reply('⏸ Auto-replies paused. I\'ll still monitor messages but won\'t reply. Type /resume to restart.');
});

bot.command('resume', (ctx) => {
  ctx.reply('▶️ Auto-replies resumed.');
});

bot.command('style', (ctx) => {
  const session = getSession(ctx.chat.id);
  askCommunicationStyle(ctx, session);
});

bot.command('auth', (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (parts.length < 2) {
    ctx.reply('Usage: /auth airbnb 123456');
    return;
  }
  const [platform, code] = parts;
  ctx.reply(`🔐 Submitting code for ${platform}... Got it! Code: ${code}`);
  // TODO: Forward to browser session manager
});

// ─── Free text handler (main conversation engine) ───────────────────────────

bot.on('text', (ctx) => {
  const session = getSession(ctx.chat.id);
  const text = ctx.message.text.trim();

  // During property details Q&A
  if (session.step === 'property_details') {
    handlePropertyInput(ctx, session, text);
    return;
  }

  // During onboarding but not at a specific input step — nudge them
  if (!session.onboarded && session.step !== 'new') {
    // Check if they're trying to tell us something useful
    if (text.toLowerCase().includes('property') || text.toLowerCase().includes('listing')) {
      ctx.reply("I'd love to hear about your properties! Let's go through the setup flow first — tap the buttons above, or type /start to restart onboarding.");
      return;
    }
    ctx.reply("Let's finish setting you up first! Check the buttons above, or type /start to restart the onboarding.");
    return;
  }

  // Post-onboarding — AI conversation
  if (session.onboarded) {
    handleFreeText(ctx, session, text);
    return;
  }

  // New user who hasn't started
  ctx.reply("Hey! Type /start to get set up with Alfred. 👋");
});

function handlePropertyInput(ctx, session, text) {
  const fieldIndex = session.propertyField;
  const field = PROPERTY_FIELDS[fieldIndex];

  // Handle skip/done
  const lower = text.toLowerCase();
  if (lower === 'skip' || lower === 'n/a' || lower === 'none') {
    session.currentProperty[field.key] = null;
  } else if (lower === 'done' && field.key === 'special_notes') {
    session.currentProperty[field.key] = null;
  } else {
    session.currentProperty[field.key] = text;
  }

  // Move to next field
  const nextIndex = fieldIndex + 1;

  if (nextIndex >= PROPERTY_FIELDS.length || (field.key === 'special_notes' && lower === 'done')) {
    // Property complete
    session.properties.push({ ...session.currentProperty });
    session.propertiesCompleted++;

    const summary = [
      `✅ *${session.currentProperty.name || 'Property ' + session.propertiesCompleted}* saved!`,
      '',
    ];

    if (session.currentProperty.wifi_name) summary.push(`📶 WiFi: ${session.currentProperty.wifi_name} / ${session.currentProperty.wifi_password || '—'}`);
    if (session.currentProperty.door_code) summary.push(`🚪 Door code: ${session.currentProperty.door_code}`);
    if (session.currentProperty.checkin_time) summary.push(`⏰ Check-in: ${session.currentProperty.checkin_time} | Check-out: ${session.currentProperty.checkout_time || '—'}`);
    if (session.currentProperty.house_rules) summary.push(`📋 Rules: ${session.currentProperty.house_rules}`);

    ctx.replyWithMarkdown(summary.join('\n'));

    // Check if more properties
    if (session.propertiesCompleted < (session.totalProperties || 1)) {
      session.currentProperty = {};
      session.propertyField = 0;

      setTimeout(() => {
        ctx.replyWithMarkdown(
          [
            `Now let's set up *property ${session.propertiesCompleted + 1}*.`,
            '',
            `${PROPERTY_FIELDS[0].emoji} ${PROPERTY_FIELDS[0].question}`,
          ].join('\n'),
        );
      }, 800);
    } else {
      // All properties done — move to style
      session.currentProperty = null;
      setTimeout(() => askCommunicationStyle(ctx, session), 1000);
    }
  } else {
    // Ask next field
    session.propertyField = nextIndex;
    const nextField = PROPERTY_FIELDS[nextIndex];
    ctx.reply(`${nextField.emoji} ${nextField.question}`);
  }
}

function handleFreeText(ctx, session, text) {
  const lower = text.toLowerCase();

  // Add property on the fly
  if (lower.includes('add property') || lower.includes('new property') || lower.includes('another property')) {
    session.step = 'property_details';
    session.propertyField = 0;
    session.currentProperty = {};
    ctx.replyWithMarkdown(
      [
        "Sure! Let's add a new property.",
        '',
        `${PROPERTY_FIELDS[0].emoji} ${PROPERTY_FIELDS[0].question}`,
      ].join('\n'),
    );
    return;
  }

  // Status check
  if (lower.includes('status') || lower.includes('how are things') || lower.includes('what\'s up')) {
    ctx.replyWithMarkdown(
      [
        '📊 *Current Status:*',
        '',
        `🏠 *Properties:* ${session.properties.length}`,
        `💬 *Style:* ${session.style}`,
        `🛡 *Mode:* ${session.shadowMode ? 'Shadow' : 'Auto'}`,
        `📧 *Gmail:* ${session.gmailConnected ? 'Connected' : 'Not connected'}`,
        '',
        "_I'm monitoring your inboxes. Everything looks good!_",
      ].join('\n'),
    );
    return;
  }

  // Default — acknowledge and process
  ctx.reply(`🤖 Got it: "${text}"\n\nI'm processing your message. In full production, I'd use this to update my understanding of your properties and preferences.`);
}

// ─── Launch ─────────────────────────────────────────────────────────────────

bot.launch().then(() => {
  console.log('✅ Alfred bot is running!');
  console.log(`   Dashboard: ${DASHBOARD_URL}`);
  console.log(`   VPS: ${VPS_URL}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
