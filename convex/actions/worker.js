"use node";
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
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`workerFetch ${path} returned non-JSON (status ${res.status}):`, text.slice(0, 200));
    return { status: "error", error: `Non-JSON response from worker: ${text.slice(0, 100)}` };
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// AI Agent Platform Browse — Alfred visits the platform like a human assistant
// ─────────────────────────────────────────────────────────────────────────────

const BROWSER_AGENT_URL = process.env.BROWSER_AGENT_URL ?? "";

async function agentFetch(path, body) {
  if (!BROWSER_AGENT_URL) {
    throw new Error("BROWSER_AGENT_URL not configured. Set it to your agent_manager service URL.");
  }
  const res = await fetch(`${BROWSER_AGENT_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`agentFetch ${path} returned non-JSON (${res.status}):`, text.slice(0, 200));
    throw new Error(`Agent service error (${res.status}): ${text.slice(0, 100)}`);
  }
}

// Agent browse a single tenant's platform — called by cron or manually
export const agentBrowseSync = internalAction({
  args: {
    tenantId: v.id("tenants"),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch the stored browser session for this tenant + platform
    const session = await ctx.runQuery(internal.reservations.getBrowserSession, {
      tenantId: args.tenantId,
      platform: args.platform,
    });

    if (!session || !session.storageState) {
      console.log(`[agentBrowseSync] No session for ${args.tenantId}/${args.platform} — skipping`);
      return { status: "no_session" };
    }

    // 2. Call the Browser Use / Gemma agent on the VPS
    let result;
    try {
      result = await agentFetch("/platform-sync", {
        tenant_id: String(args.tenantId),
        platform: args.platform,
        storage_state: session.storageState,
        base_url: session.finalUrl || "",
      });
    } catch (e) {
      console.error(`[agentBrowseSync] Agent call failed:`, e);
      await ctx.runMutation(internal.agents.logActivity, {
        tenantId: args.tenantId,
        agentType: "alfred",
        actionType: "agent_browse_failed",
        summary: `${args.platform} agent browse failed: ${String(e).slice(0, 200)}`,
      });
      return { status: "error", error: String(e) };
    }

    // 3. Handle auth-expired
    if (result.status === "auth_required") {
      // Mark session as invalid so Settings page shows "Session expired"
      await ctx.runMutation(internal.onboarding.invalidateBrowserSession, {
        tenantId: args.tenantId,
        platform: args.platform,
      });
      await ctx.runMutation(internal.agents.logActivity, {
        tenantId: args.tenantId,
        agentType: "alfred",
        actionType: "session_expired",
        summary: `${args.platform} session expired — re-connect needed`,
      });
      return { status: "auth_required" };
    }

    // 4. Save updated storage state if agent refreshed the session
    if (result.updated_storage_state) {
      await ctx.runMutation(internal.onboarding.saveBrowserSession, {
        tenantId: args.tenantId,
        platform: args.platform,
        storageState: result.updated_storage_state,
        finalUrl: session.finalUrl,
      });
    }

    let upserted = 0;

    // 5. Upsert reservations
    for (const r of result.reservations || []) {
      if (!r.guestName || !r.checkIn || !r.checkOut) continue;
      await ctx.runMutation(internal.reservations.upsertReservation, {
        tenantId: args.tenantId,
        platform: args.platform,
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        propertyName: r.propertyName || "Unknown Property",
        status: r.status || "confirmed",
        guests: r.guests ?? null,
        payout: r.payout ?? null,
        reservationId: r.reservationId ?? null,
      });
      upserted++;
    }

    // 6. Upsert inbox conversations
    for (const msg of result.inbox || []) {
      if (!msg.guestName) continue;
      await ctx.runMutation(internal.chat.upsertConversation, {
        tenantId: args.tenantId,
        platform: args.platform,
        guestName: msg.guestName,
        threadId: msg.threadUrl || null,
        messages: [
          {
            sender: "guest",
            content: msg.messagePreview || "",
            sentAt: Date.now(),
          },
        ],
      });
    }

    // 7. Upsert properties
    for (const prop of result.properties || []) {
      if (!prop.name) continue;
      await ctx.runMutation(internal.reservations.upsertProperty, {
        tenantId: args.tenantId,
        name: prop.name,
        platform: args.platform,
        location: prop.location || "",
      });
    }

    await ctx.runMutation(internal.agents.logActivity, {
      tenantId: args.tenantId,
      agentType: "alfred",
      actionType: "agent_browse_complete",
      summary: `${args.platform} agent sync: ${upserted} reservations, ${result.inbox?.length ?? 0} messages, ${result.properties?.length ?? 0} properties`,
      metadata: {
        platform: args.platform,
        reservations: upserted,
        inbox: result.inbox?.length ?? 0,
        properties: result.properties?.length ?? 0,
        syncedAt: result.synced_at,
      },
    });

    console.log(`[agentBrowseSync] Done: ${upserted} reservations, ${result.inbox?.length ?? 0} msgs, ${result.properties?.length ?? 0} props`);
    return {
      status: "ok",
      reservations: upserted,
      inbox: result.inbox?.length ?? 0,
      properties: result.properties?.length ?? 0,
    };
  },
});

// Fan-out: browse all active tenants across all platforms (called by cron)
export const agentBrowseAllTenants = internalAction({
  handler: async (ctx) => {
    const sessions = await ctx.runQuery(internal.queries.getActiveBrowserSessions);

    for (let i = 0; i < sessions.length; i++) {
      const delayMs = i * 15000; // 15 s gap between tenants to avoid hammering VPS
      await ctx.scheduler.runAfter(delayMs, internal.actions.worker.agentBrowseSync, {
        tenantId: sessions[i].tenantId,
        platform: sessions[i].platform,
      });
    }

    console.log(`[agentBrowseAll] Scheduled ${sessions.length} agent syncs`);
  },
});
