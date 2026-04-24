// ==UserScript==
// @name         Host4Me Sync
// @namespace    https://host4me.vercel.app
// @version      2.4.0
// @description  Syncs VRBO/Airbnb reservations and messages by intercepting API calls + reading Apollo SSR cache
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
 * Host4Me Sync v2.4
 *
 * Two-track data collection:
 *   1. XHR/fetch interceptors (installed at document-start) — catches dynamic API calls
 *   2. Apollo SSR cache reader (runs after DOM ready) — catches server-rendered data
 *      baked into window.__APOLLO_STATE__ (VRBO's inbox is SSR, so this is critical)
 *
 * Token self-healing:
 *   - Auto-clears tokens that don't match Convex ID format (leftover from old script versions)
 *   - Clears token if webhook returns an invalid-token error, prompts on next sync
 *
 * Sends reservations + messages to Convex webhook.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  const CONFIG = {
    WEBHOOK_URL: 'https://brainy-gnu-879.convex.site/webhooks/userscript-sync',
    TOKEN_KEY: 'host4me_sync_token',
    COOLDOWN_MS: 15 * 60 * 1000,
    SETTLE_MS: 5000,
  };

  // ---------------------------------------------------------------------------
  // Network interception — installed at document-start before page JS runs
  // ---------------------------------------------------------------------------
  const captured = [];

  const INTERESTING_URL = [
    /reservation/i, /booking/i, /listing/i, /propert/i,
    /calendar/i, /inbox/i, /hosted/i, /member/i,
    /\/api\//i, /graphql/i, /\/pm\//i, /\/supply\//i,
    /expedia/i, /vrbo/i, /\/v\d+\//i,
  ];

  const INTERESTING_KEYS = [
    // reservations
    '"reservations"', '"bookings"', '"reservationId"', '"confirmationCode"',
    '"checkIn"', '"checkOut"', '"checkInDate"', '"checkOutDate"',
    '"stayDates"', '"arrivalDate"', '"departureDate"',
    '"guestName"', '"guestFirstName"', '"travelerFirstName"',
    '"hostPayout"', '"ownerAmount"', '"earningAmount"',
    // messages / conversations
    '"conversations"', '"threads"', '"messages"', '"inbox"',
    '"conversationId"', '"threadId"', '"subject"',
    '"participants"', '"guestInfo"', '"hostMessage"',
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
      captured.push({ url, data: JSON.parse(text) });
      console.debug('[Host4Me] captured:', url);
    } catch (_) {}
  }

  // XHR interceptor
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
        if (ct.includes('json') || ct.includes('javascript')) tryCapture(url, this.responseText);
      }
    });
    return _XHRSend.apply(this, arguments);
  };

  // Fetch interceptor
  const _fetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input
               : (input instanceof URL)   ? input.toString()
               : input?.url || '';
    const resp = await _fetch.apply(this, arguments);
    if (resp.ok) resp.clone().text().then(text => tryCapture(url, text)).catch(() => {});
    return resp;
  };

  // ---------------------------------------------------------------------------
  // Apollo SSR cache reader — handles VRBO's server-rendered inbox/reservation data
  // ---------------------------------------------------------------------------
  function readApolloCache() {
    const items = [];
    try {
      // VRBO embeds Apollo cache in window.__APOLLO_STATE__ after SSR
      const state = window.__APOLLO_STATE__
        || window.__NEXT_DATA__?.props?.apolloState
        || window.__EG_APOLLO_STATE__;
      if (!state || typeof state !== 'object') return items;

      // Apollo cache keys are like "Reservation:abc123", "Conversation:xyz", etc.
      for (const [key, val] of Object.entries(state)) {
        if (!val || typeof val !== 'object') continue;
        items.push({ url: `apollo-cache:${key}`, data: val });
      }
      console.log(`[Host4Me] Apollo cache: found ${items.length} entries`);
    } catch (e) {
      console.debug('[Host4Me] Apollo cache read error:', e);
    }
    return items;
  }

  // ---------------------------------------------------------------------------
  // Conversation/message extractor
  // ---------------------------------------------------------------------------
  function extractMessages(allData) {
    const messages = [];
    const seen = new Set();

    for (const { url, data } of allData) {
      try {
        extractMessagesFromObject(data, messages, seen);
      } catch (_) {}
    }
    return messages;
  }

  function extractMessagesFromObject(obj, out, seen) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(item => extractMessagesFromObject(item, out, seen));
      return;
    }

    // Detect a conversation/thread object
    const get = (...keys) => {
      for (const k of keys) {
        const v = k.split('.').reduce((o, p) => o?.[p], obj);
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return null;
    };

    const guestName = get('guestName', 'guest.name', 'guestFirstName')
      || [get('guestFirstName', 'travelerFirstName'), get('guestLastName', 'travelerLastName')].filter(Boolean).join(' ')
      || null;
    const propertyName = get('propertyName', 'listing.name', 'unit.name', 'property.name', 'propertyId') || '';
    const checkIn = get('checkIn', 'checkInDate', 'arrivalDate', 'stayDates.checkIn', 'dates.checkin');
    const checkOut = get('checkOut', 'checkOutDate', 'departureDate', 'stayDates.checkOut', 'dates.checkout');
    const status = get('status', 'reservationStatus', 'bookingStatus', 'inquiryStatus') || 'inquiry';
    const reservationId = get('reservationId', 'confirmationCode', 'conversationId', 'threadId', 'id');

    // Only emit if it looks like a guest conversation (has guest name + some dates or ID)
    if (guestName && (checkIn || reservationId)) {
      const key = reservationId || `${guestName}|${checkIn}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ guestName, propertyName, checkIn, checkOut, status, reservationId });
      }
    }

    // Recurse into nested objects/arrays
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') extractMessagesFromObject(v, out, seen);
    }
  }

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
    // Auto-clear tokens that don't look like a valid Convex tenant ID
    // (Convex IDs are 20-40 lowercase alphanumeric chars, no dashes/dots/uppercase)
    if (t && !/^[a-z0-9]{20,40}$/.test(t)) {
      console.log('[Host4Me] Clearing invalid token format, will re-prompt');
      GM_setValue(CONFIG.TOKEN_KEY, '');
      t = '';
    }
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
    return Date.now() - parseInt(GM_getValue('h4m_last_' + location.hostname, '0'), 10) >= CONFIG.COOLDOWN_MS;
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
        if (/token|auth|session|user|tuid|eg_|expedia/i.test(k)) out[k] = localStorage.getItem(k);
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

    // Merge network-intercepted + Apollo SSR cache data
    const apolloItems = readApolloCache();
    const allData = [
      ...captured,
      ...apolloItems,
    ];

    // Extract messages/conversations from all data sources
    const messages = extractMessages(allData);

    console.log(`[Host4Me] Syncing ${platform}: ${captured.length} network captures + ${apolloItems.length} Apollo cache entries → ${messages.length} conversations found`);

    const payload = {
      token,
      platform,
      data: {
        finalUrl: location.href,
        cookies: document.cookie,
        localStorage: readLocalStorage(),
        endpoints: captured.map(r => ({ url: r.url, status: 200, data: r.data })),
        // Extracted conversations/messages (from both network + Apollo SSR)
        messages,
      },
    };

    try {
      const resp = await gmPost(payload);
      const body = JSON.parse(resp.responseText || '{}');
      if (resp.status === 200 && body.ok) {
        markSynced();
        const n = body.result?.upserted || 0;
        const m = body.result?.messages || 0;
        const summary = [n > 0 && `${n} reservations`, m > 0 && `${m} messages`].filter(Boolean).join(', ');
        notify(summary ? `Synced: ${summary} ✓` : 'Sync complete — check dashboard');
        console.log('[Host4Me] sync result:', body.result);
      } else {
        console.error('[Host4Me] Webhook error:', resp.status, resp.responseText);
        // If the token was rejected, clear it so the user gets prompted on next sync
        if (resp.status === 401 || resp.status === 500) {
          try {
            const errBody = JSON.parse(resp.responseText || '{}');
            if (String(errBody.error || '').toLowerCase().includes('token')) {
              GM_setValue(CONFIG.TOKEN_KEY, '');
              notify('Invalid sync token cleared — you will be prompted on next sync');
              return;
            }
          } catch (_) {}
        }
        notify('Sync failed — see console');
      }
    } catch (e) {
      console.error('[Host4Me] Sync error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    const platform = getPlatform();
    if (!platform) return;

    GM_registerMenuCommand('\uD83D\uDD04 Sync Host4Me Now', () => {
      captured.length = 0;
      GM_setValue('h4m_last_' + location.hostname, '0');
      setTimeout(() => performSync(true), 1000);
    });
    GM_registerMenuCommand('\uD83D\uDD11 Reset Host4Me Token', () => {
      GM_setValue(CONFIG.TOKEN_KEY, '');
      alert('Token cleared. You will be prompted on next sync.');
    });

    setTimeout(() => performSync(false), CONFIG.SETTLE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

})();
