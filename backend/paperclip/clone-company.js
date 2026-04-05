#!/usr/bin/env node
/**
 * Clone Company Script
 *
 * Creates a new Paperclip company from the Host4Me template.
 * Usage: node clone-company.js --name "PM Company" --pm "John Smith" --timezone "America/Vancouver"
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

const TEMPLATE_PATH = path.join(__dirname, 'company-template.json');
const PAPERCLIP_URL = process.env.PAPERCLIP_URL || 'http://localhost:3100';
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY || '';

const { values: args } = parseArgs({
  options: {
    name: { type: 'string', short: 'n' },
    pm: { type: 'string', short: 'p' },
    timezone: { type: 'string', short: 't', default: 'America/Vancouver' },
    currency: { type: 'string', short: 'c', default: 'CAD' },
    'telegram-token': { type: 'string' },
    'style-preset': { type: 'string', default: 'professional' },
    'dry-run': { type: 'boolean', default: false },
  },
});

if (!args.name || !args.pm) {
  console.error('Usage: node clone-company.js --name "Company Name" --pm "PM Name"');
  console.error('');
  console.error('Required:');
  console.error('  --name, -n     Company name');
  console.error('  --pm, -p       Property manager name');
  console.error('');
  console.error('Optional:');
  console.error('  --timezone, -t      Timezone (default: America/Vancouver)');
  console.error('  --currency, -c      Currency (default: CAD)');
  console.error('  --telegram-token    Telegram bot token for this PM');
  console.error('  --style-preset      Communication style: professional|friendly|casual|luxury');
  console.error('  --dry-run           Print the config without creating the company');
  process.exit(1);
}

async function cloneCompany() {
  // Read template
  const templateRaw = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  // Replace placeholders
  const config = templateRaw
    .replace(/\{\{company_name\}\}/g, args.name)
    .replace(/\{\{pm_name\}\}/g, args.pm)
    .replace(/\{\{timezone\}\}/g, args.timezone)
    .replace(/\{\{currency\}\}/g, args.currency)
    .replace(/\{\{telegram_bot_token\}\}/g, args['telegram-token'] || 'PENDING')
    .replace(/\{\{telegram_chat_id\}\}/g, 'PENDING')
    .replace(/\{\{style_preset\}\}/g, args['style-preset'])
    .replace(/\{\{platforms\}\}/g, '[]')
    .replace(/\{\{properties\}\}/g, '[]')
    .replace(/\{\{custom_samples\}\}/g, '[]')
    .replace(/\{\{tone_keywords\}\}/g, '[]')
    .replace(/\{\{escalation_overrides\}\}/g, '{}');

  const parsed = JSON.parse(config);

  if (args['dry-run']) {
    console.log('=== DRY RUN — Company Configuration ===');
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  // Create company via Paperclip API
  console.log(`Creating company "${args.name}" for PM "${args.pm}"...`);

  const response = await fetch(`${PAPERCLIP_URL}/api/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(PAPERCLIP_API_KEY && { Authorization: `Bearer ${PAPERCLIP_API_KEY}` }),
    },
    body: JSON.stringify(parsed),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to create company: ${response.status} ${response.statusText}`);
    console.error(error);
    process.exit(1);
  }

  const result = await response.json();

  console.log('');
  console.log('✅ Company created successfully!');
  console.log(`   Company ID: ${result.id || 'N/A'}`);
  console.log(`   Name: ${args.name}`);
  console.log(`   PM: ${args.pm}`);
  console.log(`   Timezone: ${args.timezone}`);
  console.log(`   Style: ${args['style-preset']}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Assign a Telegram bot token (if not provided)');
  console.log('  2. Connect Airbnb/VRBO accounts via onboarding portal');
  console.log('  3. Upload house rules and property details');
  console.log('  4. Configure communication style');
  console.log('  5. Enable shadow mode → review → go live');
}

cloneCompany().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
