/**
 * Telegram Mini App — Server-side initData validation.
 *
 * Validates that data from a Telegram Mini App is authentic by verifying
 * the HMAC-SHA256 signature using the bot token.
 *
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

const crypto = require('crypto');

/**
 * Validate Telegram Mini App initData.
 *
 * @param {string} initData - The raw initData string from Telegram WebApp
 * @param {string} botToken - The bot token used to sign the data
 * @returns {{ valid: boolean, data: object }} Validation result and parsed data
 */
function validateInitData(initData, botToken) {
  if (!initData || !botToken) {
    return { valid: false, data: null };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    return { valid: false, data: null };
  }

  // Remove hash from the params and sort alphabetically
  params.delete('hash');
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  // Create HMAC-SHA256 using a key derived from the bot token
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    return { valid: false, data: null };
  }

  // Parse user data
  const data = Object.fromEntries(entries);
  if (data.user) {
    try {
      data.user = JSON.parse(data.user);
    } catch {
      // Keep as string if not valid JSON
    }
  }

  // Check auth_date freshness (reject if older than 1 hour)
  if (data.auth_date) {
    const authTime = parseInt(data.auth_date, 10) * 1000;
    const maxAge = 60 * 60 * 1000; // 1 hour
    if (Date.now() - authTime > maxAge) {
      return { valid: false, data: null };
    }
  }

  return { valid: true, data };
}

module.exports = { validateInitData };
