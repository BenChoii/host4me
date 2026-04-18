import { query, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Query: get all reservations for the current tenant
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!tenant) return [];

    return ctx.db
      .query("reservations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .collect();
  },
});

// Action: scrape reservations from VPS and upsert into DB
export const syncReservations = action({
  args: {
    platform: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tenant = await ctx.runQuery(internal.tenants.tenantByUserId, { userId });
    if (!tenant) throw new Error("Tenant not found");

    const platform = args.platform || "vrbo";

    // Get browser session for this platform
    const session = await ctx.runQuery(internal.reservations.getBrowserSession, {
      tenantId: tenant._id,
      platform,
    });
    if (!session || !session.storageState) {
      throw new Error(`No ${platform} session found. Please connect your ${platform} account first.`);
    }

    const liveBrowserUrl = process.env.LIVE_BROWSER_URL;
    if (!liveBrowserUrl) {
      throw new Error("LIVE_BROWSER_URL not configured");
    }

    // Call the VPS scraper
    const response = await fetch(`${liveBrowserUrl}/scrape-reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_state: session.storageState,
        platform,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Scrape error (${response.status}): ${text}`);
    }

    const result = await response.json();

    // Upsert reservations + feed into knowledge graph
    const reservations = result.reservations || [];
    for (const res of reservations) {
      await ctx.runMutation(internal.reservations.upsertReservation, {
        tenantId: tenant._id,
        platform,
        guestName: res.guestName || "Unknown",
        checkIn: res.checkIn || "",
        checkOut: res.checkOut || "",
        propertyName: res.propertyName || "",
        status: res.status || "confirmed",
        guests: res.guests || null,
        payout: res.payout || null,
        reservationId: res.reservationId || null,
      });

      // Feed into Alfred's Brain knowledge graph
      if (res.guestName && res.guestName !== "Unknown") {
        await ctx.runMutation(internal.knowledge.ingestReservation, {
          tenantId: tenant._id,
          guestName: res.guestName,
          propertyName: res.propertyName || "Unknown Property",
          platform,
          checkIn: res.checkIn || "",
          checkOut: res.checkOut || "",
          status: res.status || "confirmed",
          guests: res.guests || null,
          payout: res.payout || null,
        });
      }
    }

    // Upsert scraped listings as properties + feed into knowledge graph
    const listings = result.listings || [];
    for (const listing of listings) {
      await ctx.runMutation(internal.reservations.upsertProperty, {
        tenantId: tenant._id,
        name: listing.name || "Unknown Property",
        platform,
        location: listing.location || "",
      });

      // Feed into Alfred's Brain knowledge graph
      await ctx.runMutation(internal.knowledge.ingestProperty, {
        tenantId: tenant._id,
        name: listing.name || "Unknown Property",
        platform,
        location: listing.location || "",
      });
    }

    // Log activity
    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: tenant._id,
      agentType: "alfred",
      actionType: "reservations_synced",
      summary: `Synced ${reservations.length} reservations and ${listings.length} listings from ${platform}`,
      metadata: {
        platform,
        reservationCount: reservations.length,
        listingCount: listings.length,
        debugPageText: result.debug_page_text || "",
        debugUrlsVisited: result.debug_urls_visited || [],
        finalUrl: result.final_url || "",
      },
    });

    return {
      reservations: reservations.length,
      listings: listings.length,
      debug: {
        pageText: result.debug_page_text || "",
        urlsVisited: result.debug_urls_visited || [],
        finalUrl: result.final_url || "",
      },
    };
  },
});

// Internal query: get browser session
export const getBrowserSession = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("browserSessions")
      .withIndex("by_tenant_platform", (q) =>
        q.eq("tenantId", args.tenantId).eq("platform", args.platform)
      )
      .unique();
  },
});

// Internal mutation: upsert a reservation
export const upsertReservation = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
    guestName: v.string(),
    checkIn: v.string(),
    checkOut: v.string(),
    propertyName: v.string(),
    status: v.string(),
    guests: v.union(v.number(), v.null()),
    payout: v.union(v.string(), v.number(), v.null()),
    reservationId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // Check for existing by guest + dates + property
    const existing = await ctx.db
      .query("reservations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) =>
        q.and(
          q.eq(q.field("guestName"), args.guestName),
          q.eq(q.field("checkIn"), args.checkIn),
          q.eq(q.field("platform"), args.platform)
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        checkOut: args.checkOut,
        propertyName: args.propertyName,
        status: args.status,
        guests: args.guests,
        payout: args.payout,
        reservationId: args.reservationId,
      });
    } else {
      await ctx.db.insert("reservations", {
        tenantId: args.tenantId,
        platform: args.platform,
        guestName: args.guestName,
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        propertyName: args.propertyName,
        status: args.status,
        guests: args.guests,
        payout: args.payout,
        reservationId: args.reservationId,
      });
    }
  },
});

// Internal mutation: upsert a property from scrape
export const upsertProperty = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    platform: v.string(),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("properties")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), args.name),
          q.eq(q.field("platform"), args.platform)
        )
      )
      .first();

    if (!existing) {
      await ctx.db.insert("properties", {
        tenantId: args.tenantId,
        name: args.name,
        platform: args.platform,
        location: args.location,
        bedrooms: 0,
        maxGuests: 0,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        houseRules: "",
        wifiPassword: null,
        gateCode: null,
        parkingInstructions: null,
        metadata: {},
      });
    }
  },
});
