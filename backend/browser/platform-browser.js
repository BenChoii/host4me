/**
 * Platform Browser Agent
 *
 * Uses Playwright to log into Airbnb/VRBO, check inboxes,
 * send replies, and perform actions on behalf of property managers.
 *
 * Each PM gets their own persistent browser context (cookies saved).
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.HOST4ME_DATA_DIR || '/opt/host4me/data';

class PlatformBrowser {
  constructor(pmId) {
    this.pmId = pmId;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionDir = path.join(DATA_DIR, 'sessions', pmId);
  }

  async init() {
    fs.mkdirSync(this.sessionDir, { recursive: true });

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Persistent context saves cookies/localStorage between sessions
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      storageState: this._getStoragePath(),
    });

    this.page = await this.context.newPage();
  }

  _getStoragePath() {
    const storagePath = path.join(this.sessionDir, 'storage.json');
    if (fs.existsSync(storagePath)) {
      return storagePath;
    }
    return undefined;
  }

  async _saveSession() {
    const storagePath = path.join(this.sessionDir, 'storage.json');
    await this.context.storageState({ path: storagePath });
  }

  /**
   * Login to Airbnb
   */
  async loginAirbnb(email, password) {
    try {
      await this.page.goto('https://www.airbnb.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Check if already logged in
      if (this.page.url().includes('/hosting') || this.page.url() === 'https://www.airbnb.com/') {
        const isLoggedIn = await this.page.$('[data-testid="cypress-headernav-profile"]');
        if (isLoggedIn) {
          await this._saveSession();
          return { status: 'already_logged_in' };
        }
      }

      // Click "Continue with email"
      const emailButton = await this.page.$('button[data-testid="social-auth-button-email"]');
      if (emailButton) {
        await emailButton.click();
        await this.page.waitForTimeout(1000);
      }

      // Enter email
      const emailInput = await this.page.$('input[type="email"], input[name="email"], #email-login-email');
      if (emailInput) {
        await emailInput.fill(email);
        // Click continue/next
        const continueBtn = await this.page.$('button[type="submit"], button[data-testid="signup-login-submit-btn"]');
        if (continueBtn) await continueBtn.click();
        await this.page.waitForTimeout(2000);
      }

      // Enter password
      const passwordInput = await this.page.$('input[type="password"], input[name="password"]');
      if (passwordInput) {
        await passwordInput.fill(password);
        const loginBtn = await this.page.$('button[type="submit"]');
        if (loginBtn) await loginBtn.click();
        await this.page.waitForTimeout(3000);
      }

      // Check for 2FA
      const twoFaInput = await this.page.$('input[name="code"], input[data-testid="verification-code-input"]');
      if (twoFaInput) {
        await this._saveSession();
        return { status: '2fa_required', message: 'Airbnb is asking for a verification code. Check your email or phone.' };
      }

      // Check if login succeeded
      const currentUrl = this.page.url();
      if (currentUrl.includes('/hosting') || currentUrl.includes('airbnb.com')) {
        await this._saveSession();
        const title = await this.page.title();
        return { status: 'logged_in', url: currentUrl, title };
      }

      // Take screenshot for debugging
      const screenshotPath = path.join(this.sessionDir, 'login-result.png');
      await this.page.screenshot({ path: screenshotPath });

      return { status: 'unknown', url: currentUrl, screenshot: screenshotPath };

    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Submit 2FA code
   */
  async submit2FA(code) {
    try {
      const codeInput = await this.page.$('input[name="code"], input[data-testid="verification-code-input"], input[inputmode="numeric"]');
      if (!codeInput) {
        return { status: 'error', message: 'No 2FA input found on page' };
      }

      await codeInput.fill(code);

      const submitBtn = await this.page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await this.page.waitForTimeout(3000);

      await this._saveSession();

      return { status: 'submitted', url: this.page.url() };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Check Airbnb hosting inbox for unread messages
   */
  async checkAirbnbInbox() {
    try {
      await this.page.goto('https://www.airbnb.com/hosting/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Check if redirected to login
      if (this.page.url().includes('/login')) {
        return { status: 'auth_required' };
      }

      await this.page.waitForTimeout(3000);

      // Extract conversations from inbox
      const messages = await this.page.evaluate(() => {
        const threads = document.querySelectorAll('[data-testid="conversation-thread"], [role="listitem"]');
        const results = [];

        threads.forEach(thread => {
          const nameEl = thread.querySelector('[data-testid="guest-name"], h3, [class*="name"]');
          const previewEl = thread.querySelector('[data-testid="message-preview"], p, [class*="preview"]');
          const isUnread = thread.querySelector('[class*="unread"], [class*="badge"], [class*="dot"]') !== null;

          if (nameEl) {
            results.push({
              guest_name: nameEl.textContent?.trim() || 'Unknown',
              message_preview: previewEl?.textContent?.trim() || '',
              is_unread: isUnread,
              needs_reply: isUnread,
            });
          }
        });

        return results;
      });

      await this._saveSession();
      return { status: 'ok', messages, count: messages.length };

    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Send a reply in an Airbnb conversation
   */
  async sendAirbnbReply(threadUrl, message) {
    try {
      await this.page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (this.page.url().includes('/login')) {
        return { status: 'auth_required' };
      }

      await this.page.waitForTimeout(2000);

      // Find message input
      const input = await this.page.$('textarea, [data-testid="message-input"], [contenteditable="true"]');
      if (!input) {
        return { status: 'error', message: 'Could not find message input' };
      }

      await input.fill(message);
      await this.page.waitForTimeout(500);

      // Click send
      const sendBtn = await this.page.$('button[data-testid="send-message-button"], button[type="submit"]');
      if (sendBtn) {
        await sendBtn.click();
        await this.page.waitForTimeout(2000);
        await this._saveSession();
        return { status: 'sent' };
      }

      return { status: 'error', message: 'Could not find send button' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = { PlatformBrowser };
