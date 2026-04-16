import { mutation, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Save platform credentials during onboarding
export const saveCredentials = mutation({
  args: {
    platform: v.string(),
    encryptedEmail: v.string(),
    encryptedPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!tenant) throw new Error("Tenant not found");

    // Upsert credentials
    const existing = await ctx.db
      .query("platformCredentials")
      .withIndex("by_tenant_platform", (q) =>
        q.eq("tenantId", tenant._id).eq("platform", args.platform)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedEmail: args.encryptedEmail,
        encryptedPassword: args.encryptedPassword,
        status: "pending",
      });
    } else {
      await ctx.db.insert("platformCredentials", {
        tenantId: tenant._id,
        platform: args.platform,
        encryptedEmail: args.encryptedEmail,
        encryptedPassword: args.encryptedPassword,
        status: "pending",
        lastVerifiedAt: null,
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

// Trigger Airbnb login via Worker VPS browser agent
export const connectAirbnb = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Look up tenant
    const tenant = await ctx.runQuery(internal.tenants.tenantByUserId, { userId });
    if (!tenant) throw new Error("Tenant not found");

    // Save credentials first
    await ctx.runMutation(internal.onboarding.saveCredentialsInternal, {
      tenantId: tenant._id,
      platform: "airbnb",
      email: args.email,
      password: args.password,
    });

    const workerUrl = process.env.WORKER_VPS_URL;
    const workerSecret = process.env.WORKER_API_SECRET;

    if (!workerUrl || !workerSecret) {
      throw new Error("Worker VPS not configured. Set WORKER_VPS_URL and WORKER_API_SECRET env vars.");
    }

    const response = await fetch(`${workerUrl}/browser/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        tenant_id: tenant._id,
        platform: "airbnb",
        email: args.email,
        password: args.password,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Worker error (${response.status}): ${text}`);
    }

    const result = await response.json();

    // Log the activity
    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: tenant._id,
      agentType: "alfred",
      actionType: "platform_login",
      summary: `Airbnb login attempt: ${result.status || "initiated"}`,
      metadata: { platform: "airbnb", status: result.status },
    });

    return result;
  },
});

// Internal mutation to save credentials (called from connectAirbnb action)
export const saveCredentialsInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("platformCredentials")
      .withIndex("by_tenant_platform", (q) =>
        q.eq("tenantId", args.tenantId).eq("platform", args.platform)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedEmail: args.email,
        encryptedPassword: args.password,
        status: "pending",
      });
    } else {
      await ctx.db.insert("platformCredentials", {
        tenantId: args.tenantId,
        platform: args.platform,
        encryptedEmail: args.email,
        encryptedPassword: args.password,
        status: "pending",
        lastVerifiedAt: null,
      });
    }
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
