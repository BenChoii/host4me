// ==UserScript==
// @name         Host4Me Sync
// @namespace    https://host4me.vercel.app
// @version      2.3.0
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
 * Host4Me Sync v2.3
 *
 * Two-track data collection:
 *   1. XHR/fetch interceptors (installed at document-start) — catches dynamic API calls
 *   2. Apollo SSR cache reader (runs after DOM ready) — catches server-rendered data
 *      baked into window.__APOLLO_STATE__ (VRBO's inbox is SSR, so this is critical)
 *
 * Sends reservations + messages to Convex webhook.
 */

(function () {
  'use strict';

  const CONFIG = {
    WEBHOOK_URL: 'https://brainy-gnu-879.convex.site/webhooks/userscript-sync',
    TOKEN_KEY: 'host4me_sync_token',
    COOLDOWN_MS: 15 * 60 * 1000,
    SETTLE_MS: 5000,
  };

  const captured = [];

  const INTERESTING_URL = [
    /reservation/i, /booking/i, /listing/i, /propert/i,
    /calendar/i, /inbox/i, /hosted/i, /member/i,
    /\/api\//i, /graphql/i, /\/pm\//i, /\/supply\//i,
    /expedia/i, /vrbo/i, /\/v\d+\//i,
  ];

  const INTERESTING_KEYS = [
    '"reservations"', '"bookings"', '"reservationId"', '"confirmationCode"',
    '"checkIn"', '"checkOut"', '"checkInDate"', '"checkOutDate"',
    '"stayDates"', '"arrivalDate"', '"departureDate"',
    '"guestName"', '"guestFirstName"', '"travelerFirstName"',
    '"hostPayout"', '"ownerAmount"', '"earningAmount"',
    '"conversations"', '"threads"', '"messages"', '"inbox"',
    '"conversationId"', '"threadId"', '"subject"',
    '"participants"', '"guestInfo"', '"hostMessage"',
  ];

  function urlIsInteresting(url) { return INTERESTING_URL.some(p => p.test(url)); }
  function bodyIsInteresting(text) { return text && text.length > 20 && INTERESTING_KEYS.some(k => text.includes(k)); }
  function tryCapture(url, text) {
    if (!text) return;
    if (!urlIsInteresting(url) && !bodyIsInteresting(text)) return;
    try { captured.push({ url, data: JSON.parse(text) }); console.debug('[Host4Me] captured:', url); } catch (_) {}
  }

  const _XHROpen = XMLHttpRequest.prototype.open;
  const _XHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this._h4mUrl = String(url || ''); return _XHROpen.apply(this, arguments); };
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

  const _fetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input instanceof URL) ? input.toString() : input?.url || '';
    const resp = await _fetch.apply(this, arguments);
    if (resp.ok) resp.clone().text().then(text => tryCapture(url, text)).catch(() => {});
    return resp;
  };

  // ---------------------------------------------------------------------------
  // Apollo SSR cache reader
  // ---------------------------------------------------------------------------
  function readApolloCache() {
    const items = [];
    try {
      const state = window.__APOLLO_STATE__ || window.__NEXT_DATA__?.props?.apolloState || window.__EG_APOLLO_STATE__;
      if (!state || typeof state !== 'object') return items;
      for (const [key, val] of Object.entries(state)) {
        if (val && typeof val === 'object') items.push({ url: `apollo-cache:${key}`, data: val });
      }
      console.log(`[Host4Me] Apollo cache: ${items.length} entries`);
    } catch (e) { console.debug('[Host4Me] Apollo cache read error:', e); }
    return items;
  }

  // ---------------------------------------------------------------------------
  // Conversation/message extractor
  // ---------------------------------------------------------------------------
  function extractMessages(allData) {
    const messages = [];
    const seen = new Set();
    for (const { url, data } of allData) {
      try { extractMessagesFromObject(data, messages, seen); } catch (_) {}
    }
    return messages;
  }

  function extractMessagesFromObject(obj, out, seen) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(item => extractMessagesFromObject(item, out, seen)); return; }
    const get = (...keys) => {
      for (const k of keys) { const v = k.split('.').reduce((o, p) => o?.[p], obj); if (v !== undefined && v !== null && v !== '') return v; }
      return null;
    };
    const guestName = get('guestName', 'guest.name', 'guestFirstName')
      || [get('guestFirstName', 'travelerFirstName'), get('guestLastName', 'travelerLastName')].filter(Boolean).join(' ')
      || null;
    const checkIn = get('checkIn', 'checkInDate', 'arrivalDate', 'stayDates.checkIn', 'dates.checkin');
    const checkOut = get('checkOut', 'checkOutDate', 'departureDate', 'stayDates.checkOut', 'dates.checkout');
    const propertyName = get('propertyName', 'listing.name', 'unit.name', 'property.name', 'propertyId') || '';
    const status = get('status', 'reservationStatus', 'bookingStatus', 'inquiryStatus') || 'inquiry';
    const reservationId = get('reservationId', 'confirmationCode', 'conversationId', 'threadId', 'id');
    if (guestName && (checkIn || reservationId)) {
      const key = reservationId || `${guestName}|${checkIn}`;
      if (!seen.has(key)) { seen.add(key); out.push({ guestName, propertyName, checkIn, checkOut, status, reservationId }); }
    }
    for (const v of Object.values(obj)) { if (v && typeof v === 'object') extractMessagesFromObject(v, out, seen); }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function getPlatform() {
    const h = location.hostname;
    if (h.includes('vrbo.com')) return 'vrbo';
    if (h.includes('airbnb.com')) return 'airbnb';
    if (h.includes('booking.com')) return 'booking';
    return null;
  }
  function getSyncToken() {
    let t = GM_getValue(CONFIG.TOKEN_KEY, '');
    if (!t) { t = prompt('Host4Me: Paste your sync token from:\nhttps://host4me.vercel.app/dashboard/settings', ''); if (t) GM_setValue(CONFIG.TOKEN_KEY, t.trim()); }
    return t ? t.trim() : null;
  }
  function cooldownPassed() { return Date.now() - parseInt(GM_getValue('h4m_last_' + location.hostname, '0'), 10) >= CONFIG.COOLDOWN_MS; }
  function markSynced() { GM_setValue('h4m_last_' + location.hostname, String(Date.now())); }
  function notify(msg) { try { GM_notification({ title: 'Host4Me', text: msg, timeout: 5000 }); } catch (_) { console.log('[Host4Me]', msg); } }
  function readLocalStorage() {
    const out = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/token|auth|session|user|tuid|eg_|expedia/i.test(k)) out[k] = localStorage.getItem(k); } } catch (_) {}
    return out;
  }
  function gmPost(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({ method: 'POST', url: CONFIG.WEBHOOK_URL, headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(payload), onload: r => resolve(r), onerror: () => reject(new Error('network error')), ontimeout: () => reject(new Error('timeout')) });
    });
  }

  // ---------------------------------------------------------------------------
  // Main sync
  // ---------------------------------------------------------------------------
  async function performSync(force) {
    const platform = getPlatform();
    if (!platform) return;
    if (!force && !cooldownPassed()) { console.log('[Host4Me] Sync skipped — cooldown not elapsed'); return; }
    const token = getSyncToken();
    if (!token) { console.log('[Host4Me] No sync token'); return; }

    const apolloItems = readApolloCache();
    const allData = [...captured, ...apolloItems];
    const messages = extractMessages(allData);

    console.log(`[Host4Me] Syncing ${platform}: ${captured.length} network + ${apolloItems.length} Apollo → ${messages.length} conversations`);

    const payload = { token, platform, data: { finalUrl: location.href, cookies: document.cookie, localStorage: readLocalStorage(), endpoints: captured.map(r => ({ url: r.url, status: 200, data: r.data })), messages } };

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
        notify('Sync failed — see console');
      }
    } catch (e) { console.error('[Host4Me] Sync error:', e); }
  }

  function init() {
    const platform = getPlatform();
    if (!platform) return;
    GM_registerMenuCommand('🔄 Sync Host4Me Now', () => { captured.length = 0; GM_setValue('h4m_last_' + location.hostname, '0'); setTimeout(() => performSync(true), 1000); });
    GM_registerMenuCommand('🔑 Reset Host4Me Token', () => { GM_setValue(CONFIG.TOKEN_KEY, ''); alert('Token cleared. You will be prompted on next sync.'); });
    setTimeout(() => performSync(false), CONFIG.SETTLE_MS);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { setTimeout(init, 0); }

})();
