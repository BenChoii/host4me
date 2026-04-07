import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One tenant per Clerk user
  tenants: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    timezone: v.string(),
    plan: v.string(), // "free" | "starter" | "growth" | "portfolio"
    actionsUsed: v.number(),
    actionsLimit: v.union(v.number(), v.null()), // null = unlimited (paid)
    onboarded: v.boolean(),
    telegramChatId: v.union(v.string(), v.null()),
    telegramBotToken: v.union(v.string(), v.null()),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_telegram_chat", ["telegramChatId"]),

  // Rental properties
  properties: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    platform: v.string(), // "airbnb" | "vrbo" | "booking"
    location: v.string(),
    bedrooms: v.number(),
    maxGuests: v.number(),
    checkInTime: v.string(),
    checkOutTime: v.string(),
    houseRules: v.string(),
    wifiPassword: v.union(v.string(), v.null()),
    gateCode: v.union(v.string(), v.null()),
    parkingInstructions: v.union(v.string(), v.null()),
    metadata: v.any(), // flexible extra data
  }).index("by_tenant", ["tenantId"]),

  // Encrypted platform credentials (Airbnb, VRBO, etc.)
  platformCredentials: defineTable({
    tenantId: v.id("tenants"),
    platform: v.string(),
    encryptedEmail: v.string(),
    encryptedPassword: v.string(),
    status: v.string(), // "pending" | "connected" | "expired" | "error"
    lastVerifiedAt: v.union(v.number(), v.null()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_platform", ["tenantId", "platform"]),

  // Gmail OAuth connections
  gmailConnections: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    status: v.string(), // "active" | "expired" | "revoked"
    lastSyncAt: v.union(v.number(), v.null()),
  }).index("by_tenant", ["tenantId"]),

  // Browser sessions (Playwright storage state)
  browserSessions: defineTable({
    tenantId: v.id("tenants"),
    platform: v.string(),
    storageState: v.string(), // JSON string of Playwright storage state
    isValid: v.boolean(),
  }).index("by_tenant_platform", ["tenantId", "platform"]),

  // Alfred's persistent memory — learned facts per tenant
  alfredMemory: defineTable({
    tenantId: v.id("tenants"),
    category: v.string(), // "property_detail" | "guest_pattern" | "pm_preference" | "insight" | "listing_info"
    key: v.string(), // e.g. "wifi_password:sunset_villa" or "checkin_pattern:weekend"
    value: v.string(),
    source: v.string(), // "gmail" | "airbnb_inbox" | "pm_conversation" | "inferred"
    confidence: v.number(), // 0-1, how sure Alfred is about this fact
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_category", ["tenantId", "category"]),

  // Chat history (PM ↔ Alfred via Telegram, stored for persistence)
  chatHistory: defineTable({
    tenantId: v.id("tenants"),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
    metadata: v.optional(v.any()), // extra context (triggered action, etc.)
  }).index("by_tenant", ["tenantId"]),

  // Guest conversations from platform inboxes
  conversations: defineTable({
    tenantId: v.id("tenants"),
    propertyId: v.union(v.id("properties"), v.null()),
    platform: v.string(),
    guestName: v.string(),
    threadId: v.union(v.string(), v.null()), // platform-specific thread ID
    status: v.string(), // "active" | "escalated" | "resolved" | "archived"
    lastMessageAt: v.number(),
    summary: v.union(v.string(), v.null()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  // Messages within guest conversations
  messages: defineTable({
    conversationId: v.id("conversations"),
    sender: v.string(), // "guest" | "alfred" | "pm"
    content: v.string(),
    sentAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // Agent activity log
  agentActivity: defineTable({
    tenantId: v.id("tenants"),
    agentType: v.string(), // "alfred" | "guest_reply" | "pricing_research" | "gmail_scan" | "inbox_check"
    actionType: v.string(), // "message_sent" | "inbox_checked" | "gmail_scanned" | "insight_generated" | "escalation_created"
    summary: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_tenant", ["tenantId"]),

  // Scheduled reports config
  scheduledReports: defineTable({
    tenantId: v.id("tenants"),
    type: v.string(), // "daily" | "weekly" | "monthly"
    enabled: v.boolean(),
    sendAt: v.string(), // "08:00" for daily, "monday 09:00" for weekly
    lastSentAt: v.union(v.number(), v.null()),
  }).index("by_tenant", ["tenantId"]),

  // Escalations
  escalations: defineTable({
    tenantId: v.id("tenants"),
    conversationId: v.union(v.id("conversations"), v.null()),
    level: v.string(), // "urgent" | "action" | "info"
    summary: v.string(),
    recommendation: v.union(v.string(), v.null()),
    status: v.string(), // "open" | "resolved"
    resolvedAt: v.union(v.number(), v.null()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),
});
