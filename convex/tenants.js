import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Get the current user's tenant (creates one if it doesn't exist)
export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (existing) return existing._id;

    // Create new tenant
    const tenantId = await ctx.db.insert("tenants", {
      clerkUserId: identity.subject,
      name: identity.name ?? "",
      email: identity.email ?? "",
      timezone: "America/New_York",
      plan: "free",
      actionsUsed: 0,
      actionsLimit: 100,
      onboarded: false,
      telegramChatId: null,
      telegramBotToken: null,
    });

    // Set up default scheduled reports
    await ctx.db.insert("scheduledReports", {
      tenantId,
      type: "daily",
      enabled: true,
      sendAt: "08:00",
      lastSentAt: null,
    });
    await ctx.db.insert("scheduledReports", {
      tenantId,
      type: "weekly",
      enabled: true,
      sendAt: "monday 09:00",
      lastSentAt: null,
    });

    return tenantId;
  },
});

// Get current tenant data
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
  },
});

// Update tenant profile
export const update = mutation({
  args: {
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) throw new Error("Tenant not found");

    const updates = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.timezone !== undefined) updates.timezone = args.timezone;

    await ctx.db.patch(tenant._id, updates);
  },
});

// Mark tenant as onboarded
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) throw new Error("Tenant not found");

    await ctx.db.patch(tenant._id, { onboarded: true });
  },
});

// Create tenant from Clerk webhook (when user signs up)
export const createFromWebhook = internalMutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantId = await ctx.db.insert("tenants", {
      clerkUserId: args.clerkUserId,
      name: args.name,
      email: args.email,
      timezone: "America/New_York",
      plan: "free",
      actionsUsed: 0,
      actionsLimit: 100,
      onboarded: false,
      telegramChatId: null,
      telegramBotToken: null,
    });

    // Default scheduled reports
    await ctx.db.insert("scheduledReports", {
      tenantId,
      type: "daily",
      enabled: true,
      sendAt: "08:00",
      lastSentAt: null,
    });
    await ctx.db.insert("scheduledReports", {
      tenantId,
      type: "weekly",
      enabled: true,
      sendAt: "monday 09:00",
      lastSentAt: null,
    });

    return tenantId;
  },
});

// Internal query: find tenant by Clerk user ID
export const tenantByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
  },
});

// Set Telegram connection (called after PM clicks deep link and /starts the bot)
export const setTelegramConnection = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    chatId: v.string(),
    botToken: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tenantId, {
      telegramChatId: args.chatId,
      telegramBotToken: args.botToken,
    });
  },
});

// Increment action usage (called by agent actions)
export const incrementUsage = internalMutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return;
    await ctx.db.patch(args.tenantId, {
      actionsUsed: tenant.actionsUsed + 1,
    });
  },
});

// Check if tenant can perform an action (usage limit)
export const canPerformAction = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return false;
    if (tenant.actionsLimit === null) return true; // paid plan, unlimited
    return tenant.actionsUsed < tenant.actionsLimit;
  },
});
