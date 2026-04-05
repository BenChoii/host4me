/**
 * Telegram Mini App — Secure Credential Collection
 *
 * Credentials are sent to the backend via Telegram's WebApp.sendData(),
 * which is HMAC-SHA256 signed by Telegram. The backend validates the
 * signature before processing.
 *
 * Credentials are encrypted client-side with AES-256-GCM before transmission
 * as an extra layer of defense. The backend re-encrypts with the vault key.
 */

const tg = window.Telegram.WebApp;

// Parse URL params
const params = new URLSearchParams(window.location.search);
const platform = params.get('platform') || 'airbnb';
const pmId = params.get('pm') || '';

// Update UI with platform name
const platformDisplay = platform.charAt(0).toUpperCase() + platform.slice(1);
document.getElementById('platformName').textContent = platformDisplay;
document.querySelector('.submit-btn #btnText').textContent = `Connect ${platformDisplay}`;

// Tell Telegram we're ready
tg.ready();
tg.expand();

// Set theme
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');

// Form submission
document.getElementById('credentialForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) return;

  const btn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled = true;
  btnText.textContent = 'Connecting...';
  spinner.classList.remove('hidden');

  try {
    // Encrypt credentials client-side before sending
    const encrypted = await encryptClientSide({ email, password });

    // Send via Telegram WebApp data channel (HMAC-signed by Telegram)
    const payload = JSON.stringify({
      type: 'credentials',
      platform,
      pmId,
      data: encrypted,
      timestamp: Date.now(),
    });

    // Option 1: Use Telegram's sendData (closes the Mini App, data goes to bot)
    // This is the most secure path — data is signed by Telegram servers
    tg.sendData(payload);

    // Show success (Mini App will close automatically after sendData)
    showSuccess();
  } catch (err) {
    showError(err.message || 'Connection failed. Please try again.');
  }
});

/**
 * Client-side AES-256-GCM encryption.
 * This is an extra defense layer. The backend re-encrypts with the vault key.
 * The key here is derived from the Telegram initData hash.
 */
async function encryptClientSide(data) {
  const plaintext = JSON.stringify(data);

  // Use Web Crypto API
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive a key from a combination of platform + timestamp
  // This isn't meant to be a secret key — the real encryption happens server-side.
  // This just prevents plaintext from sitting in memory/logs during transit.
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(tg.initData || 'host4me-mini-app'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('host4me'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    iv: arrayToBase64(iv),
    ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
  };
}

function arrayToBase64(arr) {
  return btoa(String.fromCharCode(...arr));
}

function showSuccess() {
  document.getElementById('credentialForm').classList.add('hidden');
  document.getElementById('successView').classList.remove('hidden');
}

function showError(message) {
  const btn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled = false;
  btnText.textContent = `Connect ${platformDisplay}`;
  spinner.classList.add('hidden');

  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorView').classList.remove('hidden');
}

function resetForm() {
  document.getElementById('errorView').classList.add('hidden');
}
