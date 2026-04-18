import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Store a chat message (PM ↔ Alfred)
export const addMessage = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    role: v.string(),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatHistory", {
      tenantId: args.tenantId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
    });
  },
});

// Get recent chat history for a tenant (for Alfred context window)
export const getHistory = query({
  args: { tenantId: v.id("tenants"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("chatHistory")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(args.limit ?? 30)
      .then((msgs) => msgs.reverse()); // chronological order
  },
});

// Get conversation threads (guest convos from platform inboxes)
export const getConversations = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!tenant) return [];

    if (args.status) {
      return ctx.db
        .query("conversations")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", tenant._id).eq("status", args.status)
        )
        .order("desc")
        .take(50);
    }

    return ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .order("desc")
      .take(50);
  },
});

// Get messages in a conversation
export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

// Store a guest conversation + messages (called by inbox monitoring)
export const upsertConversation = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
    guestName: v.string(),
    threadId: v.union(v.string(), v.null()),
    messages: v.array(
      v.object({
        sender: v.string(),
        content: v.string(),
        sentAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Find or create conversation
    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) =>
        q.and(
          q.eq(q.field("guestName"), args.guestName),
          q.eq(q.field("platform"), args.platform)
        )
      )
      .unique();

    const now = Date.now();

    if (!conversation) {
      const id = await ctx.db.insert("conversations", {
        tenantId: args.tenantId,
        propertyId: null,
        platform: args.platform,
        guestName: args.guestName,
        threadId: args.threadId,
        status: "active",
        lastMessageAt: now,
        summary: null,
      });
      conversation = { _id: id };
    } else {
      await ctx.db.patch(conversation._id, { lastMessageAt: now });
    }

    // Add new messages
    for (const msg of args.messages) {
      await ctx.db.insert("messages", {
        conversationId: conversation._id,
        sender: msg.sender,
        content: msg.content,
        sentAt: msg.sentAt,
      });
    }

    return conversation._id;
  },
});
