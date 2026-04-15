import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth routes (handles sign-in, sign-up, sign-out)
auth.addHttpRoutes(http);

// Gmail OAuth callback
http.route({
  path: "/auth/gmail/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // tenant ID

    if (!code || !state) {
      return new Response("Missing code or state", { status: 400 });
    }

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
        tenantId: state,
        email: tokens.email ?? "",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
      });
    }

    const appUrl = process.env.SITE_URL ?? "http://localhost:3000";
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

    switch (body.type) {
      case "telegram_message": {
        await ctx.runMutation(internal.chat.addMessage, {
          tenantId: body.tenantId,
          role: "user",
          content: body.message,
        });
        await ctx.scheduler.runAfter(0, internal.actions.worker.chatWithAlfred, {
          tenantId: body.tenantId,
          message: body.message,
        });
        break;
      }
      case "telegram_auth_code": {
        await ctx.scheduler.runAfter(0, internal.actions.worker.submit2FA, {
          tenantId: body.tenantId,
          platform: body.platform,
          code: body.code,
        });
        break;
      }
      case "browser_session_update": {
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
