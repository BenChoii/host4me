import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const WORKER_URL = process.env.WORKER_VPS_URL ?? "http://localhost:3200";
const WORKER_SECRET = process.env.WORKER_API_SECRET ?? "";

async function workerFetch(path, body) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Send a message to Alfred via ADK runner and get response
export const chatWithAlfred = internalAction({
  args: {
    tenantId: v.id("tenants"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await workerFetch("/agent/chat", {
      tenant_id: args.tenantId,
      message: args.message,
    });

    // Store Alfred's response
    if (result.reply) {
      await ctx.runMutation(internal.chat.addMessage, {
        tenantId: args.tenantId,
        role: "assistant",
        content: result.reply,
        metadata: result.metadata,
      });
    }

    return result;
  },
});

// Trigger Airbnb login via browser agent
export const loginAirbnb = internalAction({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await workerFetch("/browser/login", {
      tenant_id: args.tenantId,
      platform: "airbnb",
      email: args.email,
      password: args.password,
    });

    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: args.tenantId,
      agentType: "alfred",
      actionType: "platform_login",
      summary: `Airbnb login: ${result.status}`,
      metadata: result,
    });

    return result;
  },
});

// Submit 2FA code
export const submit2FA = internalAction({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return workerFetch("/browser/submit-2fa", {
      tenant_id: args.tenantId,
      platform: args.platform,
      code: args.code,
    });
  },
});

// Check a single tenant's inbox
export const checkInbox = internalAction({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const result = await workerFetch("/browser/inbox", {
      tenant_id: args.tenantId,
      platform: "airbnb",
    });

    if (result.status === "ok" && result.messages?.length > 0) {
      // Store conversations in Convex
      for (const msg of result.messages) {
        await ctx.runMutation(internal.chat.upsertConversation, {
          tenantId: args.tenantId,
          platform: "airbnb",
          guestName: msg.guest_name,
          threadId: null,
          messages: [
            {
              sender: "guest",
              content: msg.preview || "",
              sentAt: Date.now(),
            },
          ],
        });
      }

      await ctx.runMutation(internal.agents.logActivity, {
        tenantId: args.tenantId,
        agentType: "inbox_check",
        actionType: "inbox_checked",
        summary: `Found ${result.messages.length} conversations`,
        metadata: { count: result.messages.length },
      });
    }

    return result;
  },
});

// Check all tenants' inboxes (called by cron)
// Fan-out: schedule each tenant as a separate action to avoid 10-min timeout
export const checkAllInboxes = internalAction({
  handler: async (ctx) => {
    const sessions = await ctx.runQuery(
      internal.queries.getActiveBrowserSessions
    );

    // Fan out: schedule each tenant individually with staggered delays
    // This avoids sequential processing and the 10-min Convex action timeout
    for (let i = 0; i < sessions.length; i++) {
      const delayMs = i * 5000; // Stagger by 5 seconds per tenant
      await ctx.scheduler.runAfter(delayMs, internal.actions.worker.checkInbox, {
        tenantId: sessions[i].tenantId,
      });
    }

    console.log(`Scheduled inbox checks for ${sessions.length} tenants`);
  },
});

// Sync Gmail for a single tenant
export const syncGmail = internalAction({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const result = await workerFetch("/gmail/sync", {
      tenant_id: args.tenantId,
    });

    if (result.memories?.length > 0) {
      for (const memory of result.memories) {
        await ctx.runMutation(internal.agents.storeMemory, {
          tenantId: args.tenantId,
          category: memory.category,
          key: memory.key,
          value: memory.value,
          source: "gmail",
          confidence: memory.confidence ?? 0.8,
        });
      }
    }

    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: args.tenantId,
      agentType: "gmail_scan",
      actionType: "gmail_scanned",
      summary: `Synced Gmail: ${result.emails_processed ?? 0} emails, ${result.memories?.length ?? 0} facts extracted`,
    });

    return result;
  },
});

// Sync all tenants' Gmail (called by cron)
// Fan-out: schedule each tenant individually
export const syncAllGmail = internalAction({
  handler: async (ctx) => {
    const connections = await ctx.runQuery(
      internal.queries.getActiveGmailConnections
    );

    for (let i = 0; i < connections.length; i++) {
      const delayMs = i * 3000;
      await ctx.scheduler.runAfter(delayMs, internal.actions.worker.syncGmail, {
        tenantId: connections[i].tenantId,
      });
    }

    console.log(`Scheduled Gmail sync for ${connections.length} tenants`);
  },
});

// Generate and send daily briefing for a tenant
export const sendDailyBriefing = internalAction({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const result = await workerFetch("/agent/briefing", {
      tenant_id: args.tenantId,
      type: "daily",
    });

    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: args.tenantId,
      agentType: "alfred",
      actionType: "briefing_sent",
      summary: "Daily briefing delivered",
    });

    return result;
  },
});

// Send daily briefings to all tenants (called by cron)
// Fan-out: schedule each tenant individually
export const sendDailyBriefings = internalAction({
  handler: async (ctx) => {
    const tenants = await ctx.runQuery(internal.queries.getOnboardedTenants);

    for (let i = 0; i < tenants.length; i++) {
      const delayMs = i * 2000;
      await ctx.scheduler.runAfter(delayMs, internal.actions.worker.sendDailyBriefing, {
        tenantId: tenants[i]._id,
      });
    }

    console.log(`Scheduled daily briefings for ${tenants.length} tenants`);
  },
});

// Send weekly reports to all tenants (called by cron)
// Fan-out: schedule each tenant individually
export const sendWeeklyReports = internalAction({
  handler: async (ctx) => {
    const tenants = await ctx.runQuery(internal.queries.getOnboardedTenants);

    for (let i = 0; i < tenants.length; i++) {
      const delayMs = i * 2000;
      await ctx.scheduler.runAfter(delayMs, internal.actions.worker.sendWeeklyReport, {
        tenantId: tenants[i]._id,
      });
    }

    console.log(`Scheduled weekly reports for ${tenants.length} tenants`);
  },
});

// Send a single weekly report
export const sendWeeklyReport = internalAction({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const result = await workerFetch("/agent/briefing", {
      tenant_id: args.tenantId,
      type: "weekly",
    });

    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: args.tenantId,
      agentType: "alfred",
      actionType: "report_sent",
      summary: "Weekly report delivered",
    });

    return result;
  },
});
