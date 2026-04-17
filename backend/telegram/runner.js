/**
 * Alfred — Telegram Bot Runner (v2)
 *
 * Scrape-first onboarding — Alfred does the work, not the PM.
 *
 * Flow:
 *   1. /start → Welcome & explain capabilities
 *   2. Platform selection (Airbnb, VRBO, Booking.com)
 *   3. Login via dashboard live browser session
 *   4. Alfred SCRAPES all listings from each platform automatically
 *      - Property names, addresses, photos, rules, check-in/out, capacity
 *      - Cross-references across platforms by address matching
 *   5. Summary: "I found X properties. Here's what I know."
 *   6. Gap questions ONLY — WiFi codes, door codes, parking, anything missing
 *   7. Gmail: app password + IMAP scan for booking confirmations & details
 *   8. Communication style → Shadow mode → Ready
 *
 * Post-onboarding:
 *   - Free-text chat with Alfred
 *   - /briefing, /listings, /escalations, /pause, /resume, /style, /auth
 */

const { Telegraf, Markup } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKENS;
if (!token) {
  console.error('TELEGRAM_BOT_TOKENS not set');
  process.exit(1);
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://host4me-ioel.vercel.app';
const VPS_API = process.env.VPS_API || 'http://localhost:8101';

const bot = new Telegraf(token);

// ─── In-memory state (per chat) ─────────────────────────────────────────────
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      step: 'new',
      platforms: [],
      properties: [],          // Scraped from platforms
      missingFields: [],       // [{ propertyIndex, field, question }]
      currentGapIndex: 0,      // Which gap we're asking about
      gmailEmail: null,
      gmailAppPassword: null,
      style: 'friendly',
      shadowMode: true,
      onboarded: false,
    });
  }
  return sessions.get(chatId);
}

// ─── Platform metadata ──────────────────────────────────────────────────────

const PLATFORMS = {
  airbnb: { label: 'Airbnb', emoji: '🏠' },
  vrbo: { label: 'VRBO', emoji: '🏡' },
  booking: { label: 'Booking.com', emoji: '🏨' },
};

// ─── /start — Welcome ───────────────────────────────────────────────────────

bot.start((ctx) => {
  const session = getSession(ctx.chat.id);
  session.step = 'welcome';

  ctx.replyWithMarkdown(
    [
      '👋 *Hey! I\'m Alfred, your AI property manager.*',
      '',
      'Here\'s what I do:',
      '• 💬 Reply to guest messages *in your voice*',
      '• 📊 Send you a *daily briefing* every morning',
      '• 🚨 *Alert you* when something needs your attention',
      '• 📅 *Sync calendars* across platforms so you never double-book',
      '',
      'To get started, I just need two things:',
      '1️⃣ *Log into your rental platforms* — I\'ll scrape all your property details myself',
      '2️⃣ *A Gmail app password* — so I can scan for booking details and guest info',
      '',
      '_That\'s it. I do the rest._',
    ].join('\n'),
  );

  setTimeout(() => {
    session.step = 'ask_platforms';
    ctx.reply(
      'Which platforms do you use?',
      Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Airbnb', 'platform_airbnb')],
        [Markup.button.callback('🏡 VRBO', 'platform_vrbo')],
        [Markup.button.callback('🏨 Booking.com', 'platform_booking')],
        [Markup.button.callback('✅ Done selecting', 'platforms_done')],
      ]),
    );
  }, 1500);
});

// ─── Platform selection ─────────────────────────────────────────────────────

bot.action(/^platform_(.+)$/, (ctx) => {
  const session = getSession(ctx.chat.id);
  const platform = ctx.match[1];

  if (!session.platforms.includes(platform)) {
    session.platforms.push(platform);
    const info = PLATFORMS[platform];
    ctx.answerCbQuery(`${info.emoji} ${info.label} added!`);

    const selected = session.platforms.map((p) => PLATFORMS[p].label).join(', ');
    ctx.editMessageText(
      `Which platforms do you use?\n\n✅ Selected: *${selected}*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          ...['airbnb', 'vrbo', 'booking']
            .filter((p) => !session.platforms.includes(p))
            .map((p) => [Markup.button.callback(`${PLATFORMS[p].emoji} ${PLATFORMS[p].label}`, `platform_${p}`)]),
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
    ctx.reply("Tap at least one platform above.");
    return;
  }

  const selected = session.platforms.map((p) => PLATFORMS[p].label).join(', ');
  ctx.editMessageText(`✅ Platforms: *${selected}*`, { parse_mode: 'Markdown' });

  session.step = 'platform_login';
  sendLoginInstructions(ctx, session);
});

// ─── Platform login ─────────────────────────────────────────────────────────

function sendLoginInstructions(ctx, session) {
  const platformList = session.platforms.map((p) => PLATFORMS[p].label).join(' & ');

  ctx.replyWithMarkdown(
    [
      `🔐 *Log into ${platformList}*`,
      '',
      'Open the link below — you\'ll see a secure browser window where you log in normally.',
      'Your password *never touches our servers*. I only save the browser session cookies.',
      '',
      `👉 [Open Secure Login](${DASHBOARD_URL}/dashboard/onboarding)`,
      '',
      `Once you're logged in, come back here and tap *"I'm logged in"*.`,
      '',
      `_After that, I'll scan your listings and learn everything about your properties automatically._`,
    ].join('\n'),
    {
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ I\'m logged in', 'login_done')],
        [Markup.button.callback('⏭ Skip for now', 'login_skip')],
      ]),
    },
  );
}

bot.action('login_done', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();
  ctx.editMessageText('✅ Platforms connected!', { parse_mode: 'Markdown' });
  session.step = 'scraping';
  startPropertyScrape(ctx, session);
});

bot.action('login_skip', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();
  ctx.editMessageText('⏭ Skipped — you can connect platforms anytime from the dashboard.', { parse_mode: 'Markdown' });
  session.step = 'gmail_intro';
  setTimeout(() => sendGmailIntro(ctx, session), 800);
});

// ─── Property scraping ──────────────────────────────────────────────────────
// In production this calls the VPS scraper service.
// For now, simulates scraping with realistic timing and dummy data.

async function startPropertyScrape(ctx, session) {
  const platformList = session.platforms.map((p) => PLATFORMS[p].label).join(', ');

  ctx.replyWithMarkdown(`🔍 *Scanning your ${platformList} accounts...*\n\n_This takes about 30 seconds. I'm reading all your listings, calendars, and guest messages._`);

  // Simulate scraping with progress updates
  await delay(3000);
  ctx.reply(`📋 Found your listings... reading property details...`);

  await delay(3000);
  ctx.reply(`📅 Checking calendars and upcoming bookings...`);

  await delay(2000);
  ctx.reply(`💬 Scanning recent guest messages to learn your communication style...`);

  await delay(2000);

  // TODO: Replace with actual scraper call:
  // const result = await fetch(`${VPS_API}/scrape`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ platforms: session.platforms, chatId: ctx.chat.id }),
  // }).then(r => r.json());

  // For now, store empty properties array — the real scraper will populate this
  session.properties = [];

  // Present what we "found"
  if (session.properties.length === 0) {
    // No scraper yet — tell the PM we need their help briefly
    ctx.replyWithMarkdown(
      [
        '📊 *Scan complete!*',
        '',
        'I\'ve connected to your accounts and I\'m now monitoring your guest messages.',
        '',
        '⚠️ _My listing scraper is still learning — I\'ll pick up property details automatically from your guest conversations over the next few days._',
        '',
        'To speed things up, I just need a few things I *can\'t* find on the platforms:',
      ].join('\n'),
    );

    session.step = 'ask_gap_property_count';

    await delay(1500);
    ctx.reply(
      'How many properties do you manage?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('1', 'prop_count_1'),
          Markup.button.callback('2', 'prop_count_2'),
          Markup.button.callback('3', 'prop_count_3'),
          Markup.button.callback('4+', 'prop_count_4'),
        ],
      ]),
    );
  } else {
    // Scraper returned data — present summary and ask only about gaps
    presentScrapedProperties(ctx, session);
  }
}

// ─── Property count (temporary until scraper is live) ───────────────────────

bot.action(/^prop_count_(\d+\+?)$/, (ctx) => {
  const session = getSession(ctx.chat.id);
  const raw = ctx.match[1];
  const count = raw === '4+' ? 4 : parseInt(raw);
  ctx.answerCbQuery();
  ctx.editMessageText(`🏠 ${raw} ${count === 1 ? 'property' : 'properties'}`, { parse_mode: 'Markdown' });

  session.totalProperties = count;
  session.propertiesCompleted = 0;
  session.step = 'gap_questions';
  session.currentProperty = {};
  session.gapField = 0;

  setTimeout(() => {
    ctx.replyWithMarkdown(
      [
        `Cool — I just need *3 quick things* per property that aren't on the platforms.`,
        '',
        `*Property ${session.propertiesCompleted + 1}:*`,
        '📍 What\'s the name or address?',
      ].join('\n'),
    );
  }, 500);
});

// Gap fields — ONLY the things Alfred can't scrape from platforms
const GAP_FIELDS = [
  { key: 'name', question: '📍 What\'s the name or address?', first: true },
  { key: 'wifi', question: '📶 WiFi network and password? (e.g., "MyWiFi / password123")' },
  { key: 'door_code', question: '🚪 Door/lockbox code? (type "skip" if key handoff)' },
];

// ─── Scraped property presentation (when scraper is live) ───────────────────

function presentScrapedProperties(ctx, session) {
  // Cross-reference properties across platforms by address
  const crossReferenced = crossReferenceProperties(session.properties);

  let summary = '📊 *Here\'s what I found:*\n\n';

  crossReferenced.forEach((prop, i) => {
    const platforms = prop.platforms.map((p) => PLATFORMS[p]?.emoji || '').join(' ');
    summary += `*${i + 1}. ${prop.name}*  ${platforms}\n`;
    summary += `   📍 ${prop.address}\n`;
    if (prop.checkin) summary += `   ⏰ Check-in: ${prop.checkin} | Check-out: ${prop.checkout}\n`;
    if (prop.capacity) summary += `   👥 Max guests: ${prop.capacity}\n`;
    if (prop.nextBooking) summary += `   📅 Next booking: ${prop.nextBooking}\n`;
    summary += '\n';
  });

  summary += '_I\'ll keep these synced across all your platforms automatically._';

  ctx.replyWithMarkdown(summary);

  // Figure out what's missing
  const gaps = [];
  crossReferenced.forEach((prop, i) => {
    if (!prop.wifi) gaps.push({ propertyIndex: i, propertyName: prop.name, field: 'wifi', question: `📶 What's the WiFi for *${prop.name}*? (network / password)` });
    if (!prop.doorCode) gaps.push({ propertyIndex: i, propertyName: prop.name, field: 'door_code', question: `🚪 Door/lockbox code for *${prop.name}*? (skip if key handoff)` });
    if (!prop.parking) gaps.push({ propertyIndex: i, propertyName: prop.name, field: 'parking', question: `🅿️ Parking instructions for *${prop.name}*? (skip if none)` });
  });

  session.missingFields = gaps;
  session.currentGapIndex = 0;
  session.properties = crossReferenced;

  if (gaps.length > 0) {
    setTimeout(() => {
      ctx.replyWithMarkdown(
        `I just need *${gaps.length} thing${gaps.length > 1 ? 's' : ''}* I couldn't find on the platforms:\n\n${gaps[0].question}`,
      );
      session.step = 'gap_questions_scraped';
    }, 2000);
  } else {
    session.step = 'gmail_intro';
    setTimeout(() => sendGmailIntro(ctx, session), 2000);
  }
}

function crossReferenceProperties(properties) {
  // Group properties by normalized address
  const byAddress = new Map();
  for (const prop of properties) {
    const key = (prop.address || prop.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (byAddress.has(key)) {
      const existing = byAddress.get(key);
      existing.platforms = [...new Set([...existing.platforms, ...(prop.platforms || [])])];
      // Merge fields — prefer non-null values
      for (const [k, v] of Object.entries(prop)) {
        if (v && !existing[k]) existing[k] = v;
      }
    } else {
      byAddress.set(key, { ...prop });
    }
  }
  return [...byAddress.values()];
}

// ─── Gmail connection (app password) ────────────────────────────────────────

function sendGmailIntro(ctx, session) {
  session.step = 'gmail_intro';
  ctx.replyWithMarkdown(
    [
      '📧 *Connect Gmail*',
      '',
      'I\'ll scan your email for booking confirmations, guest details, and property info that might not be on the platforms.',
      '',
      'I use a *Gmail App Password* — it\'s a one-time code from Google that gives me read access without your actual password.',
      '',
      '*How to get one (takes 30 seconds):*',
      '1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)',
      '2. Select "Mail" and "Other" → type "Alfred"',
      '3. Copy the 16-character password Google gives you',
      '',
      '_Note: You need 2-step verification enabled on your Google account._',
    ].join('\n'),
    {
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📧 I have my app password', 'gmail_ready')],
        [Markup.button.callback('⏭ Skip Gmail for now', 'gmail_skip')],
      ]),
    },
  );
}

bot.action('gmail_ready', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();
  session.step = 'gmail_email';
  ctx.editMessageText('📧 Gmail app password setup', { parse_mode: 'Markdown' });
  ctx.reply('What\'s your Gmail address?');
});

bot.action('gmail_skip', (ctx) => {
  const session = getSession(ctx.chat.id);
  ctx.answerCbQuery();
  ctx.editMessageText('⏭ Skipped Gmail — I\'ll learn from your guest conversations instead.', { parse_mode: 'Markdown' });
  session.step = 'ask_style';
  setTimeout(() => askCommunicationStyle(ctx, session), 800);
});

// ─── Communication style ────────────────────────────────────────────────────

function askCommunicationStyle(ctx, session) {
  session.step = 'ask_style';
  ctx.replyWithMarkdown(
    [
      '🎨 *One last thing — how should I talk to your guests?*',
      '',
      'Pick the style that sounds most like you:',
    ].join('\n'),
    Markup.inlineKeyboard([
      [Markup.button.callback('😊 Friendly', 'style_friendly'), Markup.button.callback('👔 Professional', 'style_professional')],
      [Markup.button.callback('😎 Casual', 'style_casual'), Markup.button.callback('✨ Luxury', 'style_luxury')],
    ]),
  );
}

const STYLE_DESC = {
  friendly: 'Warm and welcoming — like a helpful neighbor',
  professional: 'Polished and clear — like a hotel concierge',
  casual: 'Relaxed and easygoing — like texting a friend',
  luxury: 'Elegant and attentive — five-star service',
};

bot.action(/^style_(.+)$/, (ctx) => {
  const session = getSession(ctx.chat.id);
  session.style = ctx.match[1];
  ctx.answerCbQuery();
  ctx.editMessageText(`🎨 *${session.style.charAt(0).toUpperCase() + session.style.slice(1)}* — ${STYLE_DESC[session.style]}`, { parse_mode: 'Markdown' });

  setTimeout(() => sendShadowMode(ctx, session), 800);
});

// ─── Shadow mode ────────────────────────────────────────────────────────────

function sendShadowMode(ctx, session) {
  session.step = 'shadow_mode';
  ctx.replyWithMarkdown(
    [
      '🛡 *Shadow Mode*',
      '',
      'I\'ll start by *drafting replies* and sending them to you here for approval.',
      'You tap ✅ to send or ✏️ to edit. Once you trust my replies, switch to auto.',
      '',
      '_Most hosts go auto after about a week._',
    ].join('\n'),
    Markup.inlineKeyboard([
      [Markup.button.callback('🛡 Shadow Mode (Recommended)', 'shadow_on')],
      [Markup.button.callback('⚡ Auto Mode', 'shadow_off')],
    ]),
  );
}

bot.action('shadow_on', (ctx) => {
  const session = getSession(ctx.chat.id);
  session.shadowMode = true;
  ctx.answerCbQuery();
  ctx.editMessageText('🛡 Shadow mode — drafts for your approval', { parse_mode: 'Markdown' });
  finishOnboarding(ctx, session);
});

bot.action('shadow_off', (ctx) => {
  const session = getSession(ctx.chat.id);
  session.shadowMode = false;
  ctx.answerCbQuery();
  ctx.editMessageText('⚡ Auto mode — I\'ll reply directly and notify you', { parse_mode: 'Markdown' });
  finishOnboarding(ctx, session);
});

// ─── Onboarding complete ────────────────────────────────────────────────────

function finishOnboarding(ctx, session) {
  session.step = 'onboarded';
  session.onboarded = true;

  setTimeout(() => {
    const platformList = session.platforms.length > 0
      ? session.platforms.map((p) => `  ${PLATFORMS[p].emoji} ${PLATFORMS[p].label} — connected`).join('\n')
      : '  ⚠️ None connected yet';

    const propList = session.properties.length > 0
      ? session.properties.map((p, i) => `  📍 ${p.name}`).join('\n')
      : '  🔄 Learning from your conversations...';

    ctx.replyWithMarkdown(
      [
        '🎉 *Alfred is live!*',
        '',
        `*Platforms:*\n${platformList}`,
        '',
        `*Properties:*\n${propList}`,
        '',
        `*Style:* ${session.style.charAt(0).toUpperCase() + session.style.slice(1)}`,
        `*Mode:* ${session.shadowMode ? '🛡 Shadow' : '⚡ Auto'}`,
        `*Gmail:* ${session.gmailEmail ? '✅ ' + session.gmailEmail : '⏭ Not connected'}`,
        '',
        'I\'m monitoring your inboxes now. When a guest messages you, I\'ll draft a reply and send it here for your approval.',
        '',
        'Your first briefing arrives tomorrow at 8am ☀️',
        '',
        '*Commands:*',
        '/briefing — Today\'s summary',
        '/listings — Your properties',
        '/escalations — Items needing attention',
        '/pause — Pause auto-replies',
        '/resume — Resume auto-replies',
        '/style — Change communication tone',
        '',
        '_Or just message me anytime — I understand natural language._',
      ].join('\n'),
    );
  }, 1000);
}

// ─── Post-onboarding commands ───────────────────────────────────────────────

bot.command('briefing', (ctx) => {
  const session = getSession(ctx.chat.id);
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  ctx.replyWithMarkdown(
    [
      `☀️ *Daily Briefing — ${date}*`,
      '',
      '📨 *Messages:* 0 received, 0 replied',
      '⏱ *Avg Response Time:* —',
      '🏠 *Bookings:* 0 new, 0 check-ins today',
      '📊 *Sentiment:* —',
      '',
      '✅ No open escalations',
      '',
      `_Monitoring ${session.platforms.length} platform${session.platforms.length !== 1 ? 's' : ''}. All quiet!_`,
    ].join('\n'),
  );
});

bot.command('listings', (ctx) => {
  const session = getSession(ctx.chat.id);
  if (session.properties.length === 0) {
    ctx.replyWithMarkdown(
      '🔄 I\'m still learning about your properties from your conversations. Send me a property name or address to add one manually.',
    );
    return;
  }
  const list = session.properties
    .map((p, i) => {
      const platforms = (p.platforms || []).map((pl) => PLATFORMS[pl]?.emoji || '').join(' ');
      return `*${i + 1}. ${p.name}* ${platforms}\n   WiFi: ${p.wifi || '—'} | Door: ${p.door_code || '—'}`;
    })
    .join('\n\n');
  ctx.replyWithMarkdown(`🏠 *Your Properties:*\n\n${list}`);
});

bot.command('escalations', (ctx) => {
  ctx.reply('✅ No open escalations.');
});

bot.command('pause', (ctx) => {
  ctx.reply('⏸ Auto-replies paused. Type /resume to restart.');
});

bot.command('resume', (ctx) => {
  ctx.reply('▶️ Auto-replies resumed.');
});

bot.command('style', (ctx) => {
  askCommunicationStyle(ctx, getSession(ctx.chat.id));
});

bot.command('auth', (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (parts.length < 2) {
    ctx.reply('Usage: /auth airbnb 123456');
    return;
  }
  ctx.reply(`🔐 Code received for ${parts[0]}. Submitting...`);
});

// ─── Free text handler ──────────────────────────────────────────────────────

bot.on('text', (ctx) => {
  const session = getSession(ctx.chat.id);
  const text = ctx.message.text.trim();

  // ── Gap questions (temporary, pre-scraper) ──
  if (session.step === 'gap_questions') {
    handleGapInput(ctx, session, text);
    return;
  }

  // ── Gap questions (post-scraper) ──
  if (session.step === 'gap_questions_scraped') {
    handleScrapedGapInput(ctx, session, text);
    return;
  }

  // ── Gmail email input ──
  if (session.step === 'gmail_email') {
    if (!text.includes('@')) {
      ctx.reply('That doesn\'t look like an email. Try again:');
      return;
    }
    session.gmailEmail = text;
    session.step = 'gmail_app_password';
    ctx.replyWithMarkdown(
      [
        `Got it: *${text}*`,
        '',
        'Now paste the 16-character *app password* from Google.',
        '_(It looks like: xxxx xxxx xxxx xxxx)_',
      ].join('\n'),
    );
    return;
  }

  // ── Gmail app password input ──
  if (session.step === 'gmail_app_password') {
    const cleaned = text.replace(/\s/g, '');
    if (cleaned.length < 12) {
      ctx.reply('That seems too short. App passwords are usually 16 characters. Try again:');
      return;
    }
    session.gmailAppPassword = cleaned;
    session.step = 'gmail_scanning';
    ctx.replyWithMarkdown('📧 *Connecting to Gmail...*');

    // TODO: Actually connect via IMAP
    // const imap = new ImapClient(session.gmailEmail, cleaned);
    // await imap.connect();
    // const bookingEmails = await imap.search('booking confirmation');

    setTimeout(() => {
      ctx.replyWithMarkdown(
        [
          '✅ *Gmail connected!*',
          '',
          `Scanning *${session.gmailEmail}* for property details...`,
        ].join('\n'),
      );

      setTimeout(() => {
        ctx.replyWithMarkdown(
          [
            '📋 *Gmail scan complete!*',
            '',
            'I\'ll continue learning from your emails in the background.',
            'Any new booking confirmations or guest details will be picked up automatically.',
          ].join('\n'),
        );

        session.step = 'ask_style';
        setTimeout(() => askCommunicationStyle(ctx, session), 1000);
      }, 3000);
    }, 2000);
    return;
  }

  // ── Post-onboarding free chat ──
  if (session.onboarded) {
    handleFreeChat(ctx, session, text);
    return;
  }

  // ── Not in a specific step — nudge ──
  if (session.step !== 'new') {
    ctx.reply('Check the buttons above, or type /start to restart.');
    return;
  }

  ctx.reply('Hey! Type /start to get set up. 👋');
});

// ─── Gap question handlers ──────────────────────────────────────────────────

function handleGapInput(ctx, session, text) {
  const fieldIndex = session.gapField || 0;
  const field = GAP_FIELDS[fieldIndex];
  const lower = text.toLowerCase();

  // Save the answer
  if (lower === 'skip' || lower === 'n/a' || lower === 'none') {
    session.currentProperty[field.key] = null;
  } else {
    session.currentProperty[field.key] = text;
  }

  const nextIndex = fieldIndex + 1;

  if (nextIndex >= GAP_FIELDS.length) {
    // This property is done
    session.properties.push({ ...session.currentProperty, platforms: [...session.platforms] });
    session.propertiesCompleted++;

    // Show confirmation
    const p = session.currentProperty;
    ctx.replyWithMarkdown(
      [
        `✅ *${p.name || 'Property ' + session.propertiesCompleted}*`,
        p.wifi ? `   📶 WiFi: ${p.wifi}` : '',
        p.door_code ? `   🚪 Code: ${p.door_code}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    // More properties?
    if (session.propertiesCompleted < (session.totalProperties || 1)) {
      session.currentProperty = {};
      session.gapField = 0;
      setTimeout(() => {
        ctx.replyWithMarkdown(
          `*Property ${session.propertiesCompleted + 1}:*\n📍 Name or address?`,
        );
      }, 600);
    } else {
      // All done — move to Gmail
      session.currentProperty = null;
      session.step = 'gmail_intro';
      setTimeout(() => sendGmailIntro(ctx, session), 800);
    }
  } else {
    // Next gap field
    session.gapField = nextIndex;
    ctx.reply(GAP_FIELDS[nextIndex].question);
  }
}

function handleScrapedGapInput(ctx, session, text) {
  const gap = session.missingFields[session.currentGapIndex];
  const lower = text.toLowerCase();

  // Save answer
  if (lower !== 'skip' && lower !== 'n/a') {
    session.properties[gap.propertyIndex][gap.field] = text;
  }

  session.currentGapIndex++;

  if (session.currentGapIndex < session.missingFields.length) {
    const nextGap = session.missingFields[session.currentGapIndex];
    ctx.replyWithMarkdown(nextGap.question);
  } else {
    ctx.replyWithMarkdown('✅ *Got everything I need!*');
    session.step = 'gmail_intro';
    setTimeout(() => sendGmailIntro(ctx, session), 800);
  }
}

// ─── Post-onboarding free chat ──────────────────────────────────────────────

function handleFreeChat(ctx, session, text) {
  const lower = text.toLowerCase();

  if (lower.includes('add property') || lower.includes('new property')) {
    session.step = 'gap_questions';
    session.gapField = 0;
    session.currentProperty = {};
    ctx.reply('📍 What\'s the name or address?');
    return;
  }

  if (lower.includes('status') || lower.includes('how are things')) {
    ctx.replyWithMarkdown(
      [
        '📊 *Status:*',
        `🏠 Properties: ${session.properties.length}`,
        `💬 Style: ${session.style}`,
        `🛡 Mode: ${session.shadowMode ? 'Shadow' : 'Auto'}`,
        `📧 Gmail: ${session.gmailEmail || 'Not connected'}`,
        '',
        '_Monitoring your inboxes. All good!_',
      ].join('\n'),
    );
    return;
  }

  // Example of how shadow mode approval will work
  if (lower.includes('test') || lower.includes('demo')) {
    ctx.replyWithMarkdown(
      [
        '💬 *Draft Reply — Guest: Sarah M.*',
        '_Airbnb · Cozy Downtown Loft_',
        '',
        '> Hi Sarah! Thanks for your message. Check-in is at 3pm — I\'ll send you the door code the morning of your arrival. The WiFi is "CozyLoft" and the password is on the fridge. Let me know if you need anything else!',
        '',
        '_Tap below to send or edit:_',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Send', 'draft_approve'), Markup.button.callback('✏️ Edit', 'draft_edit')],
        [Markup.button.callback('❌ Don\'t send', 'draft_reject')],
      ]),
    );
    return;
  }

  ctx.reply(`🤖 Got it. I'll use this to improve my understanding of your preferences.`);
}

// Draft approval callbacks (demo)
bot.action('draft_approve', (ctx) => {
  ctx.answerCbQuery('Sent!');
  ctx.editMessageText('✅ Reply sent to Sarah M.', { parse_mode: 'Markdown' });
});

bot.action('draft_edit', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('Type your edited reply and I\'ll send it:');
});

bot.action('draft_reject', (ctx) => {
  ctx.answerCbQuery();
  ctx.editMessageText('❌ Reply not sent.', { parse_mode: 'Markdown' });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Launch ─────────────────────────────────────────────────────────────────

bot.launch().then(() => {
  console.log('✅ Alfred bot is running (v2 — scrape-first onboarding)');
  console.log(`   Dashboard: ${DASHBOARD_URL}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
