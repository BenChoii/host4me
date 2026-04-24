import { mutation, query, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Public mutation: save Gmail connection
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
    await ctx.db.patch(tenant._id, {
      gmailEmail: args.email,
      gmailAccessToken: args.accessToken,
      gmailRefreshToken: args.refreshToken,
    });
  },
});

// Internal mutation: save Gmail connection (called from HTTP action)
export const connectGmailInternal = internalMutation({
  args: {
    tenantId: v.string(),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");
    await ctx.db.patch(tenant._id, {
      gmailEmail: args.email,
      gmailAccessToken: args.accessToken,
      gmailRefreshToken: args.refreshToken,
    });
  },
});

// Public mutation: add a property
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
    await ctx.db.insert("properties", {
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

// Public query: get browser session status for all platforms
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
    const sessions = await ctx.db
      .query("browserSessions")
      .withIndex("by_tenant_platform", (q) => q.eq("tenantId", tenant._id))
      .collect();
    return sessions.map((s) => ({
      platform: s.platform,
      hasSession: !!s.storageState,
      isValid: s.isValid !== false,
      finalUrl: s.finalUrl,
    }));
  },
});

// Public query: get sync token (= tenantId, used by Tampermonkey script)
export const getSyncToken = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return tenant?._id ?? null;
  },
});

// Internal query: get tenant by ID string
export const getTenantById = internalQuery({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    // Convex IDs are strings, so we can use get() directly
    try {
      return await ctx.db.get(args.tenantId);
    } catch {
      return null;
    }
  },
});

// Internal mutation: save browser session
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
        finalUrl: args.finalUrl,
        isValid: true,
      });
    } else {
      await ctx.db.insert("browserSessions", {
        tenantId: args.tenantId,
        platform: args.platform,
        storageState: args.storageState,
        finalUrl: args.finalUrl,
        isValid: true,
      });
    }
  },
});

// Public action: create a live browser session for onboarding
export const createLiveSession = action({
  args: { platform: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const tenant = await ctx.runQuery(internal.tenants.tenantByUserId, { userId });
    if (!tenant) throw new Error("Tenant not found");
    const liveBrowserUrl = process.env.LIVE_BROWSER_URL;
    if (!liveBrowserUrl) throw new Error("LIVE_BROWSER_URL not configured");
    const res = await fetch(`${liveBrowserUrl}/start-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: args.platform }),
    });
    if (!res.ok) throw new Error(`Failed to start session: ${res.status}`);
    const data = await res.json();
    return { sessionId: data.sessionId, noVncUrl: data.noVncUrl };
  },
});

// Public action: finish a live session (capture cookies)
export const finishLiveSession = action({
  args: { platform: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const tenant = await ctx.runQuery(internal.tenants.tenantByUserId, { userId });
    if (!tenant) throw new Error("Tenant not found");
    const liveBrowserUrl = process.env.LIVE_BROWSER_URL;
    if (!liveBrowserUrl) throw new Error("LIVE_BROWSER_URL not configured");
    const res = await fetch(`${liveBrowserUrl}/capture-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: args.sessionId, platform: args.platform }),
    });
    if (!res.ok) throw new Error(`Failed to capture session: ${res.status}`);
    const data = await res.json();
    await ctx.runMutation(internal.onboarding.saveBrowserSession, {
      tenantId: tenant._id,
      platform: args.platform,
      storageState: JSON.stringify(data.storageState),
      finalUrl: data.finalUrl,
    });
    return { ok: true };
  },
});

// Internal mutation: invalidate browser session
export const invalidateBrowserSession = internalMutation({
  args: { tenantId: v.id("tenants"), platform: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("browserSessions")
      .withIndex("by_tenant_platform", (q) =>
        q.eq("tenantId", args.tenantId).eq("platform", args.platform)
      )
      .unique();
    if (existing) await ctx.db.patch(existing._id, { isValid: false });
  },
});

// ---------------------------------------------------------------------------
// Helper functions for parsing reservation data from various API response formats
// ---------------------------------------------------------------------------

// Helper to collect all arrays in an object (for deep search)
function collectCandidateArrays(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== "object") return [];
  const arrays = [];
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === "object") arrays.push(obj);
    obj.forEach((item) => arrays.push(...collectCandidateArrays(item, depth + 1)));
  } else {
    for (const val of Object.values(obj)) {
      arrays.push(...collectCandidateArrays(val, depth + 1));
    }
  }
  return arrays;
}

// Helper function to parse reservations from various API endpoint response formats
function parseReservationsFromEndpoint(url, data) {
  const results = [];
  if (!data || typeof data !== "object") return results;

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
    ...(data.data ? Object.values(data.data).flatMap(v =>
      v?.edges ? [v.edges.map(e => e.node).filter(Boolean)] : []
    ) : []),
  ].filter(Array.isArray);

  const deep = collectCandidateArrays(data);
  const allCandidates = [...explicit, ...deep];
  const seen = new Set();

  for (const list of allCandidates) {
    for (const item of list) {
      const res = extractReservationFields(item);
      if (!res.checkIn && !res.guestName) continue;
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
    const tenant = await ctx.runQuery(internal.onboarding.getTenantById, { 
      tenantId: args.tenantId 
    });
    if (!tenant) throw new Error("Invalid sync token");

    const data = JSON.parse(args.rawData);

    // Store captured cookies/localStorage as browser session for VPS fallback
    if (data.cookies || data.localStorage) {
      const platformDomainMap = { vrbo: ".vrbo.com", airbnb: ".airbnb.com", booking: ".booking.com" };
      const domain = platformDomainMap[args.platform] || `.${args.platform}.com`;
      let playwrightCookies = [];
      if (data.cookies && typeof data.cookies === "string" && data.cookies.trim()) {
        playwrightCookies = data.cookies.split(";").map((pair) => {
          const eqIdx = pair.indexOf("=");
          const name = eqIdx >= 0 ? pair.slice(0, eqIdx).trim() : pair.trim();
          const value = eqIdx >= 0 ? pair.slice(eqIdx + 1).trim() : "";
          return { name, value, domain, path: "/", expires: -1, httpOnly: false, secure: true, sameSite: "None" };
        }).filter((c) => c.name);
      } else if (Array.isArray(data.cookies)) {
        playwrightCookies = data.cookies;
      }
      const origins = [];
      if (data.localStorage && Object.keys(data.localStorage).length > 0) {
        const origin = `https://${domain.replace(/^\./, "")}`;
        origins.push({ origin, localStorage: Object.entries(data.localStorage).map(([name, value]) => ({ name, value: String(value) })) });
      }
      const storageState = JSON.stringify({ cookies: playwrightCookies, origins });
      await ctx.runMutation(internal.onboarding.saveBrowserSession, {
        tenantId: tenant._id,
        platform: args.platform,
        storageState,
        finalUrl: data.finalUrl,
      });
    }

    // Parse reservations from API endpoint responses (network-intercepted)
    const reservations = [];
    const endpoints = data.endpoints || [];
    for (const ep of endpoints) {
      if (!ep.data) continue;
      const parsed = parseReservationsFromEndpoint(ep.url, ep.data);
      reservations.push(...parsed);
    }

    // Also ingest pre-extracted messages/conversations from Apollo SSR cache
    // (VRBO inbox is SSR so network interception gets 0 — this is the fallback)
    const preExtracted = data.messages || [];
    for (const msg of preExtracted) {
      if (msg.guestName || msg.reservationId) {
        reservations.push({
          guestName: msg.guestName || null,
          checkIn: msg.checkIn ? String(msg.checkIn).substring(0, 10) : null,
          checkOut: msg.checkOut ? String(msg.checkOut).substring(0, 10) : null,
          propertyName: msg.propertyName || "",
          status: msg.status || "inquiry",
          guests: null,
          payout: null,
          reservationId: msg.reservationId || null,
        });
      }
    }

    // Deduplicate
    const seen = new Set();
    const unique = reservations.filter((r) => {
      const key = r.reservationId || `${r.guestName}|${r.checkIn}`;
      if (!key || key === "null|null") return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

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
          status: res.status || "inquiry",
          guests: res.guests ?? null,
          payout: res.payout ?? null,
          reservationId: res.reservationId ?? null,
        });
        upserted++;
      } catch (e) {
        console.error("[ingestUserscriptData] upsert error:", e);
      }
    }

    return { upserted, total: unique.length, messages: preExtracted.length };
  },
});
