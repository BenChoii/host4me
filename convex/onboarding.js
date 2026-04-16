import { mutation, action, internalMutation } from "./_generated/server";
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

    // Log the activity
    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: tenant._id,
      agentType: "alfred",
      actionType: "live_session_created",
      summary: `Live browser session created for ${args.platform} login`,
      metadata: { platform: args.platform, sessionId: result.session_id },
    });

    // Return session info to frontend (session_id + noVNC URL for iframe)
    return {
      sessionId: result.session_id,
      vncUrl: result.vnc_url,
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

    // Save the captured storage state to browserSessions table
    if (result.storage_state) {
      await ctx.runMutation(internal.onboarding.saveBrowserSession, {
        tenantId: tenant._id,
        platform: args.platform,
        storageState: JSON.stringify(result.storage_state),
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
      });
    } else {
      await ctx.db.insert("browserSessions", {
        tenantId: args.tenantId,
        platform: args.platform,
        storageState: args.storageState,
        isValid: true,
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
