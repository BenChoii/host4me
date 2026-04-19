import { mutation, action, internalMutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Create a live browser session for the user to login to a platform
// Returns a noVNC URL that can be embedded in an iframe
export const createLiveSession = action({
  args: {
    platform: v.string(), // "airbnb" | "vrbo" | "booking"
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tenant = await ctx.runQuery(internal.tenants.tenantByUserId, { userId });
    if (!tenant) throw new Error("Tenant not found");

    const liveBrowserUrl = process.env.LIVE_BROWSER_URL;
    if (!liveBrowserUrl) {
      throw new Error("Live browser service not configured. Set LIVE_BROWSER_URL env var.");
    }

    const response = await fetch(`${liveBrowserUrl}/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: String(tenant._id),
        platform: args.platform,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Live browser error (${response.status}): ${text}`);
    }

    const result = await response.json();

    // Log the activity (non-fatal — don't let a logging failure block the session)
    try {
      await ctx.runMutation(internal.agents.logActivity, {
        tenantId: tenant._id,
        agentType: "alfred",
        actionType: "live_session_created",
        summary: `Live browser session created for ${args.platform} login`,
        metadata: { platform: args.platform, sessionId: result.session_id },
      });
    } catch (logErr) {
      console.warn("logActivity failed (non-fatal):", logErr);
    }

    // Construct noVNC URL routed through Caddy HTTPS reverse proxy
    // Caddy on the VPS proxies /vnc/{port}/* → localhost:{port}/*
    // This avoids mixed-content blocking (HTTP iframe inside HTTPS page)
    const vpsHost = new URL(liveBrowserUrl).hostname;
    const sslipDomain = vpsHost.replace(/\./g, "-") + ".sslip.io";
    const vncUrl = `https://${sslipDomain}/vnc/${result.ws_port}/vnc.html?autoconnect=true&resize=scale&path=vnc/${result.ws_port}/websockify`;

    return {
      sessionId: result.session_id,
      vncUrl,
      platform: args.platform,
    };
  },
});

// Finish a live browser session — captures cookies/storage state after user logs in
export const finishLiveSession = action({
  args: {
    sessionId: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tenant = await ctx.runQuery(internal.tenants.tenantByUserId, { userId });
    if (!tenant) throw new Error("Tenant not found");

    const liveBrowserUrl = process.env.LIVE_BROWSER_URL;
    if (!liveBrowserUrl) {
      throw new Error("Live browser service not configured.");
    }

    const response = await fetch(`${liveBrowserUrl}/sessions/${args.sessionId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Finish session error (${response.status}): ${text}`);
    }

    const result = await response.json();

    // Save the captured storage state (+ final URL for locale detection) to browserSessions table
    if (result.storage_state) {
      await ctx.runMutation(internal.onboarding.saveBrowserSession, {
        tenantId: tenant._id,
        platform: args.platform,
        storageState: JSON.stringify(result.storage_state),
        finalUrl: result.final_url || "",
      });
    }

    // Log the activity
    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: tenant._id,
      agentType: "alfred",
      actionType: "live_session_finished",
      summary: `${args.platform} session captured — ${result.cookie_count || 0} cookies saved`,
      metadata: {
        platform: args.platform,
        cookieCount: result.cookie_count,
        finalUrl: result.final_url,
        status: result.status,
      },
    });

    return {
      status: result.status,
      platform: result.platform,
      cookieCount: result.cookie_count,
    };
  },
});

// Internal mutation: save or update browser session storage state
export const saveBrowserSession = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
    storageState: v.string(),
    finalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("browserSessions")
      .withIndex("by_tenant_platform", (q) =>
        q.eq("tenantId", args.tenantId).eq("platform", args.platform)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        storageState: args.storageState,
        isValid: true,
        ...(args.finalUrl ? { finalUrl: args.finalUrl } : {}),
      });
    } else {
      await ctx.db.insert("browserSessions", {
        tenantId: args.tenantId,
        platform: args.platform,
        storageState: args.storageState,
        isValid: true,
        finalUrl: args.finalUrl || "",
      });
    }
  },
});

// Add a property during onboarding
export const addProperty = mutation({
  args: {
    name: v.string(),
    platform: v.string(),
    location: v.string(),
    bedrooms: v.number(),
    maxGuests: v.number(),
    checkInTime: v.string(),
    checkOutTime: v.string(),
    houseRules: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!tenant) throw new Error("Tenant not found");

    return ctx.db.insert("properties", {
      tenantId: tenant._id,
      name: args.name,
      platform: args.platform,
      location: args.location,
      bedrooms: args.bedrooms,
      maxGuests: args.maxGuests,
      checkInTime: args.checkInTime,
      checkOutTime: args.checkOutTime,
      houseRules: args.houseRules,
      wifiPassword: null,
      gateCode: null,
      parkingInstructions: null,
      metadata: {},
    });
  },
});

// Save Gmail OAuth tokens
export const connectGmail = mutation({
  args: {
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!tenant) throw new Error("Tenant not found");

    const existing = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        status: "active",
      });
    } else {
      await ctx.db.insert("gmailConnections", {
        tenantId: tenant._id,
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        status: "active",
        lastSyncAt: null,
      });
    }
  },
});

// Internal: Connect Gmail from OAuth callback
export const connectGmailInternal = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!tenant) throw new Error("Tenant not found");

    const existing = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        status: "active",
      });
    } else {
      await ctx.db.insert("gmailConnections", {
        tenantId: tenant._id,
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        status: "active",
        lastSyncAt: null,
      });
    }
  },
});

// Query: get the tenant's sync token (= their tenantId) for the userscript
export const getSyncToken = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return tenant ? String(tenant._id) : null;
  },
});

// Internal query: get tenant by ID
export const getTenantById = internalQuery({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    try {
      return await ctx.db.get(args.tenantId);
    } catch {
      return null;
    }
  },
});

// Helper function to parse reservations from various API endpoint response formats
function parseReservationsFromEndpoint(url, data) {
  const results = [];
  if (!data || typeof data !== "object") return results;

  // Try to find reservation arrays at various paths
  const candidates = [
    data.reservations,
    data.data?.reservations,
    data.items,
    data.data?.items,
    data.bookings,
    data.data?.bookings,
    Array.isArray(data) ? data : null,
    data.content,
    data.results,
  ].filter(Array.isArray);

  for (const list of candidates) {
    for (const item of list) {
      const res = extractReservationFields(item);
      if (res.checkIn || res.guestName) results.push(res);
    }
  }
  return results;
}

// Helper function to extract reservation fields from various API response formats
function extractReservationFields(item) {
  // Normalize field names across VRBO, Airbnb, Booking.com API responses
  const get = (...keys) => {
    for (const k of keys) {
      const val = k.split(".").reduce((o, p) => o?.[p], item);
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return null;
  };

  const guestName =
    get("guestName", "guest_name", "guest.name", "guestFirstName") ||
    [get("guestFirstName", "guest.firstName"), get("guestLastName", "guest.lastName")]
      .filter(Boolean)
      .join(" ") || null;

  const checkIn = get(
    "checkIn", "check_in", "checkInDate", "arrival", "startDate",
    "dates.checkin", "stayDates.checkIn"
  );
  const checkOut = get(
    "checkOut", "check_out", "checkOutDate", "departure", "endDate",
    "dates.checkout", "stayDates.checkOut"
  );

  return {
    guestName: guestName || null,
    checkIn: checkIn ? String(checkIn).substring(0, 10) : null,
    checkOut: checkOut ? String(checkOut).substring(0, 10) : null,
    propertyName: get("propertyName", "listingName", "property.name", "listing.name", "unitName") || "",
    status: get("status", "reservationStatus", "bookingStatus") || "confirmed",
    guests: get("guestCount", "numberOfGuests", "guests", "adults") || null,
    payout: get("payout", "earningAmount", "hostPayout", "totalPrice", "price.total") || null,
    reservationId: get("reservationId", "id", "confirmationCode", "bookingId", "orderId") || null,
  };
}

// Action: ingest raw scraped data from userscript and parse + store reservations
export const ingestUserscriptData = action({
  args: {
    tenantId: v.string(),
    platform: v.string(),
    rawData: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate tenantId by looking up the tenant
    const tenant = await ctx.runQuery(internal.onboarding.getTenantById, { 
      tenantId: args.tenantId 
    });
    if (!tenant) throw new Error("Invalid sync token");

    const data = JSON.parse(args.rawData);
    
    // Store captured cookies/localStorage as browser session for VPS fallback
    if (data.cookies || data.localStorage) {
      const sessionData = {
        source: "userscript",
        cookies: data.cookies || "",
        localStorage: data.localStorage || {},
        capturedAt: Date.now(),
      };
      await ctx.runMutation(internal.onboarding.saveBrowserSession, {
        tenantId: tenant._id,
        platform: args.platform,
        storageState: JSON.stringify(sessionData),
        finalUrl: data.finalUrl,
      });
    }

    // Parse reservations from API endpoint responses
    const reservations = [];
    const endpoints = data.endpoints || [];
    
    for (const ep of endpoints) {
      if (!ep.data) continue;
      const parsed = parseReservationsFromEndpoint(ep.url, ep.data);
      reservations.push(...parsed);
    }

    // Deduplicate by reservationId or (guestName + checkIn)
    const seen = new Set();
    const unique = reservations.filter((r) => {
      const key = r.reservationId || `${r.guestName}|${r.checkIn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Upsert each reservation
    let upserted = 0;
    for (const res of unique) {
      try {
        await ctx.runMutation(internal.reservations.upsertReservation, {
          tenantId: tenant._id,
          platform: args.platform,
          guestName: res.guestName || "Unknown Guest",
          checkIn: res.checkIn || "",
          checkOut: res.checkOut || "",
          propertyName: res.propertyName || "",
          status: res.status || "confirmed",
          guests: res.guests ?? null,
          payout: res.payout ?? null,
          reservationId: res.reservationId ?? null,
        });
        upserted++;
      } catch (e) {
        console.error("[ingestUserscriptData] upsert error:", e);
      }
    }

    return { upserted, total: unique.length };
  },
});
