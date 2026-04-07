import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// Internal: Get all tenants with active browser sessions (for cron inbox checks)
export const getActiveBrowserSessions = internalQuery({
  handler: async (ctx) => {
    // Get all valid browser sessions
    return ctx.db
      .query("browserSessions")
      .filter((q) => q.eq(q.field("isValid"), true))
      .collect();
  },
});

// Internal: Get all active Gmail connections (for cron sync)
export const getActiveGmailConnections = internalQuery({
  handler: async (ctx) => {
    return ctx.db
      .query("gmailConnections")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

// Internal: Get all onboarded tenants (for cron briefings)
export const getOnboardedTenants = internalQuery({
  handler: async (ctx) => {
    return ctx.db
      .query("tenants")
      .filter((q) => q.eq(q.field("onboarded"), true))
      .collect();
  },
});

// Get properties for current tenant
export const getProperties = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) return [];

    return ctx.db
      .query("properties")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();
  },
});

// Get escalations for current tenant
export const getEscalations = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) return [];

    if (args.status) {
      return ctx.db
        .query("escalations")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", tenant._id).eq("status", args.status)
        )
        .collect();
    }

    return ctx.db
      .query("escalations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();
  },
});

// Get platform credentials status for current tenant
export const getCredentialStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) return [];

    const creds = await ctx.db
      .query("platformCredentials")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    // Return without encrypted values
    return creds.map((c) => ({
      _id: c._id,
      platform: c.platform,
      status: c.status,
      lastVerifiedAt: c.lastVerifiedAt,
    }));
  },
});

// Get Gmail connection status
export const getGmailStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) return null;

    const conn = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .unique();

    if (!conn) return null;

    return {
      email: conn.email,
      status: conn.status,
      lastSyncAt: conn.lastSyncAt,
    };
  },
});
