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

// Internal mutation: mark a browser session as invalid (session expired)
export const invalidateBrowserSession = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("browserSessions")
      .withIndex("by_tenant_platform", (q) =>
        q.eq("tenantId", args.tenantId).eq("platform", args.platform)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { isValid: false });
    }
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

// Query: get browser session status for each platform (used in Settings)
export const getBrowserSessionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!tenant) return [];

    const platforms = ["vrbo", "airbnb", "booking"];
    const results = [];
    for (const platform of platforms) {
      const session = await ctx.db
        .query("browserSessions")
        .withIndex("by_tenant_platform", (q) =>
          q.eq("tenantId", tenant._id).eq("platform", platform)
        )
        .unique();
      results.push({
        platform,
        hasSession: !!session,
        isValid: session?.isValid ?? false,
        finalUrl: session?.finalUrl ?? null,
      });
    }
    return results;
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

// Recursively collect all arrays from an object that look like reservation lists
function collectCandidateArrays(obj, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== "object") return [];
  const arrays = [];

  if (Array.isArray(obj)) {
    // Only consider non-trivial arrays that contain objects
    if (obj.length > 0 && typeof obj[0] === "object") arrays.push(obj);
    for (const item of obj) arrays.push(...collectCandidateArrays(item, depth + 1));
  } else {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
        arrays.push(val);
      } else if (val && typeof val === "object") {
        arrays.push(...collectCandidateArrays(val, depth + 1));
      }
    }
  }
  return arrays;
}

// Helper function to parse reservations from various API endpoint response formats
function parseReservationsFromEndpoint(url, data) {
  const results = [];
  if (!data || typeof data !== "object") return results;

  // Explicit high-priority paths first (fast path for known formats)
  const explicit = [
    data.reservations,
    data.data?.reservations,
    data.items,
    data.data?.items,
    data.bookings,
    data.data?.bookings,
    data.hosted,
    data.data?.hosted,
    Array.isArray(data) ? data : null,
    data.content,
    data.results,
    // GraphQL connection pattern: { data: { xyzConnection: { edges: [{node: ...}] } } }
    ...(data.data ? Object.values(data.data).flatMap(v =>
      v?.edges ? [v.edges.map(e => e.node).filter(Boolean)] : []
    ) : []),
  ].filter(Array.isArray);

  // Also do a deep recursive search to handle arbitrary nesting
  const deep = collectCandidateArrays(data);

  const allCandidates = [...explicit, ...deep];
  const seen = new Set();

  for (const list of allCandidates) {
    for (const item of list) {
      const res = extractReservationFields(item);
      if (!res.checkIn && !res.guestName) continue;
      // Deduplicate within this endpoint
      const key = res.reservationId || `${res.guestName}|${res.checkIn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(res);
    }
  }
  return results;
}

// Helper function to extract reservation fields from various API response formats
function extractReservationFields(item) {
  if (!item || typeof item !== "object") return {};
  // Normalize field names across VRBO, Airbnb, Booking.com API responses
  const get = (...keys) => {
    for (const k of keys) {
      const val = k.split(".").reduce((o, p) => o?.[p], item);
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return null;
  };

  const guestName =
    get("guestName", "guest_name", "guest.name") ||
    [
      get("guestFirstName", "guest.firstName", "travelerFirstName"),
      get("guestLastName",  "guest.lastName",  "travelerLastName"),
    ].filter(Boolean).join(" ") ||
    null;

  const checkIn = get(
    "checkIn", "check_in", "checkInDate", "arrival", "startDate",
    "checkinDate", "arrivalDate",
    "dates.checkin", "stayDates.checkIn", "stayDetails.checkIn",
    "tripDetails.checkIn",
  );
  const checkOut = get(
    "checkOut", "check_out", "checkOutDate", "departure", "endDate",
    "checkoutDate", "departureDate",
    "dates.checkout", "stayDates.checkOut", "stayDetails.checkOut",
    "tripDetails.checkOut",
  );

  const propertyName = get(
    "propertyName", "listingName", "unitName",
    "property.name", "listing.name", "listing.title",
    "unit.name", "accommodation.name",
  ) || "";

  const status = get(
    "status", "reservationStatus", "bookingStatus", "state",
  ) || "confirmed";

  const guests = get(
    "guestCount", "numberOfGuests", "numGuests", "guests", "adults", "adultCount",
  );

  const payout = get(
    "payout", "earningAmount", "hostPayout", "ownerAmount",
    "totalPrice", "price.total", "pricing.total", "hostRevenue",
  );

  const reservationId = get(
    "reservationId", "confirmationCode", "bookingId", "orderId",
    "id", "reservationCode", "externalId",
  );

  return {
    guestName:    guestName || null,
    checkIn:      checkIn  ? String(checkIn).substring(0, 10)  : null,
    checkOut:     checkOut ? String(checkOut).substring(0, 10) : null,
    propertyName,
    status,
    guests:       guests ?? null,
    payout:       payout  ?? null,
    reservationId: reservationId ?? null,
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
      // Convert document.cookie string into Playwright storageState format
      const platformDomainMap = {
        vrbo: ".vrbo.com",
        airbnb: ".airbnb.com",
        booking: ".booking.com",
      };
      const domain = platformDomainMap[args.platform] || `.${args.platform}.com`;

      let playwrightCookies = [];
      if (data.cookies && typeof data.cookies === "string" && data.cookies.trim()) {
        playwrightCookies = data.cookies.split(";").map((pair) => {
          const eqIdx = pair.indexOf("=");
          const name = eqIdx >= 0 ? pair.slice(0, eqIdx).trim() : pair.trim();
          const value = eqIdx >= 0 ? pair.slice(eqIdx + 1).trim() : "";
          return {
            name,
            value,
            domain,
            path: "/",
            expires: -1,
            httpOnly: false,
            secure: true,
            sameSite: "None",
          };
        }).filter((c) => c.name);
      } else if (Array.isArray(data.cookies)) {
        // Already an array — pass through
        playwrightCookies = data.cookies;
      }

      // Build origins from localStorage
      const origins = [];
      if (data.localStorage && Object.keys(data.localStorage).length > 0) {
        const origin = `https://${domain.replace(/^\./, "")}`;
        origins.push({
          origin,
          localStorage: Object.entries(data.localStorage).map(([name, value]) => ({ name, value: String(value) })),
        });
      }

      const storageState = JSON.stringify({ cookies: playwrightCookies, origins });

      await ctx.runMutation(internal.onboarding.saveBrowserSession, {
        tenantId: tenant._id,
        platform: args.platform,
        storageState,
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
