import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // One tenant per authenticated user
  tenants: defineTable({
    userId: v.id("users"), // References authTables.users
    name: v.string(),
    email: v.string(),
    timezone: v.string(),
    plan: v.string(), // "free" | "starter" | "growth" | "portfolio"
    actionsUsed: v.number(),
    actionsLimit: v.union(v.number(), v.null()), // null = unlimited (paid)
    onboarded: v.boolean(),
    shadowMode: v.boolean(),
    communicationStyle: v.string(),
    template: v.string(),
    telegramChatId: v.union(v.string(), v.null()),
    telegramBotToken: v.union(v.string(), v.null()),
  })
    .index("by_user", ["userId"])
    .index("by_telegram_chat", ["telegramChatId"]),

  properties: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    platform: v.string(),
    location: v.string(),
    bedrooms: v.number(),
    maxGuests: v.number(),
    checkInTime: v.string(),
    checkOutTime: v.string(),
    houseRules: v.string(),
    wifiPassword: v.union(v.string(), v.null()),
    gateCode: v.union(v.string(), v.null()),
    parkingInstructions: v.union(v.string(), v.null()),
    metadata: v.any(),
  }).index("by_tenant", ["tenantId"]),

  platformCredentials: defineTable({
    tenantId: v.id("tenants"),
    platform: v.string(),
    encryptedEmail: v.string(),
    encryptedPassword: v.string(),
    status: v.string(),
    lastVerifiedAt: v.union(v.number(), v.null()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_platform", ["tenantId", "platform"]),

  gmailConnections: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    status: v.string(),
    lastSyncAt: v.union(v.number(), v.null()),
  }).index("by_tenant", ["tenantId"]),

  browserSessions: defineTable({
    tenantId: v.id("tenants"),
    platform: v.string(),
    storageState: v.string(),
    isValid: v.boolean(),
  }).index("by_tenant_platform", ["tenantId", "platform"]),

  alfredMemory: defineTable({
    tenantId: v.id("tenants"),
    category: v.string(),
    key: v.string(),
    value: v.string(),
    source: v.string(),
    confidence: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_category", ["tenantId", "category"]),

  chatHistory: defineTable({
    tenantId: v.id("tenants"),
    role: v.string(),
    content: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_tenant", ["tenantId"]),

  conversations: defineTable({
    tenantId: v.id("tenants"),
    propertyId: v.union(v.id("properties"), v.null()),
    platform: v.string(),
    guestName: v.string(),
    threadId: v.union(v.string(), v.null()),
    status: v.string(),
    lastMessageAt: v.number(),
    summary: v.union(v.string(), v.null()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    sender: v.string(),
    content: v.string(),
    sentAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  agentActivity: defineTable({
    tenantId: v.id("tenants"),
    agentType: v.string(),
    actionType: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_tenant", ["tenantId"]),

  scheduledReports: defineTable({
    tenantId: v.id("tenants"),
    type: v.string(),
    enabled: v.boolean(),
    sendAt: v.string(),
    lastSentAt: v.union(v.number(), v.null()),
  }).index("by_tenant", ["tenantId"]),

  escalations: defineTable({
    tenantId: v.id("tenants"),
    conversationId: v.union(v.id("conversations"), v.null()),
    level: v.string(),
    summary: v.string(),
    recommendation: v.union(v.string(), v.null()),
    status: v.string(),
    resolvedAt: v.union(v.number(), v.null()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),
});
