import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Clerk webhook — create tenant on user signup
http.route({
  path: "/webhooks/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    if (body.type === "user.created") {
      const user = body.data;
      // Check if tenant already exists
      const existing = await ctx.runQuery(
        internal.queries.tenantByClerkId,
        { clerkUserId: user.id }
      );

      if (!existing) {
        await ctx.runMutation(internal.tenants.createFromWebhook, {
          clerkUserId: user.id,
          name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
          email: user.email_addresses?.[0]?.email_address ?? "",
        });
      }
    }

    return new Response("OK", { status: 200 });
  }),
});

// Gmail OAuth callback
http.route({
  path: "/auth/gmail/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // tenant clerk ID

    if (!code || !state) {
      return new Response("Missing code or state", { status: 400 });
    }

    // Exchange code for tokens via Worker VPS
    const workerUrl = process.env.WORKER_VPS_URL;
    const workerSecret = process.env.WORKER_API_SECRET;

    const tokenRes = await fetch(`${workerUrl}/gmail/exchange-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({ code }),
    });

    const tokens = await tokenRes.json();

    if (tokens.access_token) {
      await ctx.runMutation(internal.onboarding.connectGmailInternal, {
        clerkUserId: state,
        email: tokens.email ?? "",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
      });
    }

    // Redirect back to dashboard onboarding
    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    return Response.redirect(`${appUrl}/dashboard/onboarding?gmail=connected`);
  }),
});

// Worker VPS callback — browser agent results, Telegram events
http.route({
  path: "/webhooks/worker",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = request.headers.get("Authorization");
    if (secret !== `Bearer ${process.env.WORKER_API_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();

    // Handle different event types from Worker VPS
    switch (body.type) {
      case "telegram_message": {
        // PM sent a message via Telegram → store and route to Alfred
        await ctx.runMutation(internal.chat.addMessage, {
          tenantId: body.tenantId,
          role: "user",
          content: body.message,
        });
        // Trigger Alfred response
        await ctx.scheduler.runAfter(0, internal.actions.worker.chatWithAlfred, {
          tenantId: body.tenantId,
          message: body.message,
        });
        break;
      }

      case "telegram_auth_code": {
        // PM sent a 2FA code via Telegram
        await ctx.scheduler.runAfter(0, internal.actions.worker.submit2FA, {
          tenantId: body.tenantId,
          platform: body.platform,
          code: body.code,
        });
        break;
      }

      case "browser_session_update": {
        // Browser agent saved a new session state
        await ctx.runMutation(internal.sessions.upsertBrowserSession, {
          tenantId: body.tenantId,
          platform: body.platform,
          storageState: body.storageState,
        });
        break;
      }

      default:
        console.log("Unknown worker event:", body.type);
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
