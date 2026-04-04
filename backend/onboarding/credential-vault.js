/**
 * Credential Vault — AES-256-GCM encrypted storage for platform credentials.
 *
 * Credentials are encrypted before storage and only decrypted by the browser
 * automation service. They are never exposed to Paperclip agents.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const VAULT_KEY = process.env.VAULT_ENCRYPTION_KEY || '';

function _getKey() {
  if (!VAULT_KEY || VAULT_KEY.length < 64) {
    throw new Error(
      'VAULT_ENCRYPTION_KEY must be a 64-character hex string. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(VAULT_KEY, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string containing IV + ciphertext + auth tag.
 */
function encrypt(plaintext) {
  const key = _getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Pack: IV (16) + tag (16) + ciphertext
  const packed = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
  return packed.toString('base64');
}

/**
 * Decrypt a base64 string encrypted with encrypt().
 */
function decrypt(encryptedBase64) {
  const key = _getKey();
  const packed = Buffer.from(encryptedBase64, 'base64');

  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt platform credentials for storage.
 */
function encryptCredentials(credentials) {
  return {
    email: credentials.email ? encrypt(credentials.email) : null,
    password: credentials.password ? encrypt(credentials.password) : null,
    encrypted: true,
    encryptedAt: new Date().toISOString(),
  };
}

/**
 * Decrypt stored platform credentials.
 */
function decryptCredentials(stored) {
  if (!stored.encrypted) {
    throw new Error('Credentials are not encrypted — refusing to process');
  }
  return {
    email: stored.email ? decrypt(stored.email) : null,
    password: stored.password ? decrypt(stored.password) : null,
  };
}

module.exports = {
  encrypt,
  decrypt,
  encryptCredentials,
  decryptCredentials,
};
