import { mutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Save platform credentials during onboarding
export const saveCredentials = mutation({
  args: {
    platform: v.string(),
    encryptedEmail: v.string(),
    encryptedPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const workerUrl = process.env.WORKER_VPS_URL;
    const workerSecret = process.env.WORKER_API_SECRET;

    const response = await fetch(`${workerUrl}/browser/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        tenant_id: identity.subject,
        platform: "airbnb",
        email: args.email,
        password: args.password,
      }),
    });

    const result = await response.json();

    // Log the activity
    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: result.tenantId, // Worker should return this
      agentType: "alfred",
      actionType: "platform_login",
      summary: `Airbnb login attempt: ${result.status}`,
      metadata: { platform: "airbnb", status: result.status },
    });

    return result;
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) throw new Error("Tenant not found");

    // Upsert Gmail connection
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
