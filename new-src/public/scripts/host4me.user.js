// ==UserScript==
// @name         Host4Me Sync
// @namespace    https://host4me.vercel.app
// @version      2.2.0
// @description  Syncs VRBO/Airbnb/Booking.com reservation data by intercepting the browser's own API calls
// @author       Host4Me
// @match        https://www.vrbo.com/*
// @match        https://owner.vrbo.com/*
// @match        https://www.airbnb.com/*
// @match        https://www.booking.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @connect      brainy-gnu-879.convex.site
// @connect      owner.vrbo.com
// @connect      www.vrbo.com
// @run-at       document-start
// ==/UserScript==

/**
 * Host4Me Sync v2.2
 *
 * Architecture: browser-native interception.
 *
 * Instead of trying to call platform APIs ourselves (which requires knowing
 * the right endpoints and doesn't work with httpOnly auth cookies), we
 * intercept the XHR/fetch calls the platform SPA makes natively.  Since
 * those calls originate from the user's logged-in browser, they carry all
 * cookies — including httpOnly ones — automatically.  We capture the
 * responses and forward the interesting ones straight to Convex.
 *
 * Flow:
 *   1. @run-at document-start: install XHR + fetch interceptors before page JS loads
 *   2. Page loads → platform SPA makes authenticated API calls → we capture them
 *   3. After SETTLE_DELAY_MS: filter captured responses for reservation/property data
 *   4. POST payload to Convex webhook → stored + VPS can re-scrape if needed
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  const CONFIG = {
    WEBHOOK_URL: 'https://brainy-gnu-879.convex.site/webhooks/userscript-sync',
    TOKEN_KEY: 'host4me_sync_token',
    COOLDOWN_MS: 15 * 60 * 1000,   // 15 min between automatic syncs per hostname
    SETTLE_MS: 5000,                // wait 5 s after page load for SPA to finish its calls
  };

  // ---------------------------------------------------------------------------
  // Network interception — installed at document-start
  // ---------------------------------------------------------------------------
  const captured = [];   // { url: string, data: any }

  /** URL patterns that might carry reservation / property data */
  const INTERESTING_URL = [
    /reservation/i, /booking/i, /listing/i, /propert/i,
    /calendar/i, /inbox/i, /hosted/i, /member/i, /gc\//i,
    // VRBO / Expedia Group specific
    /\/api\//i, /graphql/i, /\/pm\//i, /expedia/i, /vrbo/i,
    /\/v\d+\//i,   // versioned APIs like /v3/, /v2/
    /\/lp\//i,     // VRBO landing/property manager portal
  ];

  /** JSON body keys that suggest reservation content */
  const INTERESTING_KEYS = [
    '"reservations"', '"bookings"', '"listings"', '"properties"',
    '"checkIn"', '"checkOut"', '"checkInDate"', '"checkOutDate"',
    '"guestName"', '"guestFirstName"', '"confirmationCode"',
    '"reservationId"', '"tuid"', '"hostId"',
    // VRBO Canadian / Expedia Group specific
    '"stayDates"', '"arrivalDate"', '"departureDate"', '"travelerFirstName"',
    '"travelerLastName"', '"egUnit"', '"unitListing"', '"guestInfo"',
    '"reservationStatus"', '"bookingStatus"', '"rentalAgreement"',
    '"ownerAmount"', '"hostPayout"', '"earningAmount"',
  ];

  function urlIsInteresting(url) {
    return INTERESTING_URL.some(p => p.test(url));
  }

  function bodyIsInteresting(text) {
    return text && text.length > 20 && INTERESTING_KEYS.some(k => text.includes(k));
  }

  function tryCapture(url, text) {
    if (!text) return;
    if (!urlIsInteresting(url) && !bodyIsInteresting(text)) return;
    try {
      const data = JSON.parse(text);
      captured.push({ url, data });
      console.debug('[Host4Me] captured:', url);
    } catch (_) {}
  }

  // ── XHR interceptor ────────────────────────────────────────────────────────
  const _XHROpen = XMLHttpRequest.prototype.open;
  const _XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._h4mUrl = String(url || '');
    return _XHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const url = this._h4mUrl || '';
    this.addEventListener('load', function () {
      if (this.status === 200) {
        const ct = this.getResponseHeader('content-type') || '';
        if (ct.includes('json') || ct.includes('javascript')) {
          tryCapture(url, this.responseText);
        }
      }
    });
    return _XHRSend.apply(this, arguments);
  };

  // ── Fetch interceptor ──────────────────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input
               : (input instanceof URL)   ? input.toString()
               : input?.url || '';
    const resp = await _fetch.apply(this, arguments);
    if (resp.ok) {
      resp.clone().text().then(text => tryCapture(url, text)).catch(() => {});
    }
    return resp;
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function getPlatform() {
    const h = location.hostname;
    if (h.includes('vrbo.com'))    return 'vrbo';
    if (h.includes('airbnb.com'))  return 'airbnb';
    if (h.includes('booking.com')) return 'booking';
    return null;
  }

  function getSyncToken() {
    let t = GM_getValue(CONFIG.TOKEN_KEY, '');
    if (!t) {
      t = prompt(
        'Host4Me: Paste your sync token from:\nhttps://host4me.vercel.app/dashboard/settings',
        ''
      );
      if (t) GM_setValue(CONFIG.TOKEN_KEY, t.trim());
    }
    return t ? t.trim() : null;
  }

  function cooldownPassed() {
    const last = parseInt(GM_getValue('h4m_last_' + location.hostname, '0'), 10);
    return Date.now() - last >= CONFIG.COOLDOWN_MS;
  }

  function markSynced() {
    GM_setValue('h4m_last_' + location.hostname, String(Date.now()));
  }

  function notify(msg) {
    try { GM_notification({ title: 'Host4Me', text: msg, timeout: 5000 }); }
    catch (_) { console.log('[Host4Me]', msg); }
  }

  function readLocalStorage() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (/token|auth|session|user|tuid|eg_|expedia/i.test(k)) {
          out[k] = localStorage.getItem(k);
        }
      }
    } catch (_) {}
    return out;
  }

  // ---------------------------------------------------------------------------
  // Send to Convex
  // ---------------------------------------------------------------------------
  function gmPost(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: CONFIG.WEBHOOK_URL,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(payload),
        onload:   r => resolve(r),
        onerror:  () => reject(new Error('network error')),
        ontimeout:() => reject(new Error('timeout')),
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Main sync
  // ---------------------------------------------------------------------------
  async function performSync(force) {
    const platform = getPlatform();
    if (!platform) return;

    if (!force && !cooldownPassed()) {
      console.log('[Host4Me] Sync skipped — cooldown not elapsed');
      return;
    }

    const token = getSyncToken();
    if (!token) { console.log('[Host4Me] No sync token'); return; }

    console.log(`[Host4Me] Syncing ${platform} with ${captured.length} intercepted responses`);

    const payload = {
      token,
      platform,
      data: {
        finalUrl: location.href,
        cookies: document.cookie,
        localStorage: readLocalStorage(),
        // All intercepted network responses — Convex will parse reservation data from them
        endpoints: captured.map(r => ({ url: r.url, status: 200, data: r.data })),
      },
    };

    try {
      const resp = await gmPost(payload);
      const body = JSON.parse(resp.responseText || '{}');
      if (resp.status === 200 && body.ok) {
        markSynced();
        const n = body.result?.upserted || 0;
        notify(n > 0 ? `Synced ${n} reservations ✓` : 'Sync complete — no new reservations parsed (check dashboard)');
        console.log('[Host4Me] sync result:', body.result);
      } else {
        console.error('[Host4Me] Webhook error:', resp.status, resp.responseText);
        notify('Sync failed — see console');
      }
    } catch (e) {
      console.error('[Host4Me] Sync error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Init (runs after DOM ready so we can read localStorage etc.)
  // ---------------------------------------------------------------------------
  function init() {
    const platform = getPlatform();
    if (!platform) return;

    // Menu commands
    GM_registerMenuCommand('🔄 Sync Host4Me Now', () => {
      captured.length = 0;
      // Reset cooldown so manual force-sync always fires
      GM_setValue('h4m_last_' + location.hostname, '0');
      // Give the page a moment to settle if just navigated
      setTimeout(() => performSync(true), 1000);
    });

    GM_registerMenuCommand('🔑 Reset Host4Me Token', () => {
      GM_setValue(CONFIG.TOKEN_KEY, '');
      alert('Token cleared. You will be prompted on next sync.');
    });

    // Automatic sync: wait for the SPA to finish its own API calls, then sync
    setTimeout(() => performSync(false), CONFIG.SETTLE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

})();
