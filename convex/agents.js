import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Log an agent action
export const logActivity = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    agentType: v.string(),
    actionType: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentActivity", {
      tenantId: args.tenantId,
      agentType: args.agentType,
      actionType: args.actionType,
      summary: args.summary,
      metadata: args.metadata,
    });
  },
});

// Get recent activity for a tenant
export const getActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!tenant) return [];

    return ctx.db
      .query("agentActivity")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Store a memory for Alfred
export const storeMemory = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    category: v.string(),
    key: v.string(),
    value: v.string(),
    source: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if this key already exists — update if so
    const existing = await ctx.db
      .query("alfredMemory")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("key"), args.key))
      .unique();

    if (existing) {
      // Only update if new info has higher confidence
      if (args.confidence >= existing.confidence) {
        await ctx.db.patch(existing._id, {
          value: args.value,
          source: args.source,
          confidence: args.confidence,
        });
      }
    } else {
      await ctx.db.insert("alfredMemory", {
        tenantId: args.tenantId,
        category: args.category,
        key: args.key,
        value: args.value,
        source: args.source,
        confidence: args.confidence,
      });
    }
  },
});

// Get all memories for a tenant (used to build Alfred's context)
export const getMemories = query({
  args: { tenantId: v.id("tenants"), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.category) {
      return ctx.db
        .query("alfredMemory")
        .withIndex("by_tenant_category", (q) =>
          q.eq("tenantId", args.tenantId).eq("category", args.category)
        )
        .collect();
    }
    return ctx.db
      .query("alfredMemory")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});
