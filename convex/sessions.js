import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Upsert browser session (called when browser agent saves Playwright state)
export const upsertBrowserSession = internalMutation({
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

// Invalidate a browser session (expired, needs re-login)
export const invalidateSession = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("browserSessions")
      .withIndex("by_tenant_platform", (q) =>
        q.eq("tenantId", args.tenantId).eq("platform", args.platform)
      )
      .unique();

    if (session) {
      await ctx.db.patch(session._id, { isValid: false });
    }
  },
});
