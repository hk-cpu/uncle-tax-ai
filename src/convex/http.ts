/* removed "use node" directive */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

const http = typeof (globalThis as any).__httpRouter !== "undefined"
  ? (globalThis as any).__httpRouter
  : (globalThis as any).__httpRouter = httpRouter();

// Helper to send a WhatsApp message via Meta Graph API
async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("WhatsApp send skipped: missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return false;
  }

  const safeTo = String(to ?? "").trim();
  const safeBody = String(body ?? "").slice(0, 4000).trim();

  if (!safeTo) {
    console.warn("WhatsApp send skipped: empty 'to' phone number");
    return false;
  }
  if (!safeBody) {
    console.warn("WhatsApp send skipped: empty message body");
    return false;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  try {
    const res = await postWithRetry(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: safeTo,
          type: "text",
          text: { body: safeBody },
        }),
        timeoutMs: 8000,
      },
      2,
    );

    if (!res.ok) {
      let errBody = "";
      try {
        // Try parse JSON first for Graph API error details
        const asJson = await res.clone().json();
        errBody = JSON.stringify(asJson);
      } catch {
        errBody = await res.text().catch(() => "");
      }
      console.error("WhatsApp send failed", {
        status: res.status,
        statusText: res.statusText,
        body: errBody?.slice(0, 2000),
      });
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("WhatsApp send error", {
      message: err?.message ?? String(err),
      name: err?.name,
      cause: err?.cause ? String(err.cause) : undefined,
    });
    return false;
  }
}

// Add a generic POST with retry helper and timeout
async function postWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  retries = 2,
  attempt = 0
): Promise<Response> {
  const { timeoutMs = 6000, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    // Retry on 429 or 5xx
    if ((res.status === 429 || (res.status >= 500 && res.status < 600)) && retries > 0) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const backoff = Math.min(2000 * Math.pow(2, attempt), 8000);
      const delay = Math.max(retryAfter * 1000, backoff);
      await new Promise((r) => setTimeout(r, delay));
      return postWithRetry(url, init, retries - 1, attempt + 1);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      const backoff = Math.min(2000 * Math.pow(2, attempt), 8000);
      await new Promise((r) => setTimeout(r, backoff));
      return postWithRetry(url, init, retries - 1, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// GET verification endpoint
http.route({
  path: "/webhooks/whatsapp",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token && challenge) {
      if (verifyToken && token === verifyToken) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    return new Response("Bad Request", { status: 400 });
  }),
});

// POST message receiver
http.route({
  path: "/webhooks/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        console.warn("Webhook received invalid content-type", { contentType });
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const body = await req.json().catch((e) => {
        console.warn("Webhook JSON parse error", { error: String(e) });
        return null;
      });
      if (!body || !Array.isArray(body?.entry)) {
        console.warn("Webhook received invalid body shape");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const entry = body.entry[0];
      const changes = Array.isArray(entry?.changes) ? entry.changes[0] : null;
      const value = changes?.value ?? null;

      // Handle status updates gracefully (delivery/read receipts)
      if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const messages = Array.isArray(value?.messages) ? value.messages : [];

      if (!messages.length) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      for (const msg of messages) {
        try {
          if (msg?.type !== "text") continue;

          const messageId: string = msg.id ?? "";
          const messageText: string = msg.text?.body ?? "";
          const phoneNumber: string = msg.from ?? "";

          if (!messageId || !messageText || !phoneNumber) {
            console.warn("Skipping malformed message", { messageId, hasText: !!messageText, phoneNumber });
            continue;
          }

          // Rate limit per phone number before any processing
          try {
            const rl = await ctx.runMutation(internal.whatsapp.checkRateLimit, { phoneNumber });
            if (rl?.blocked) {
              const waitSec = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
              await sendWhatsAppText(
                phoneNumber,
                `⏱️ Please slow down. Try again in ${waitSec}s.`
              );
              continue; // Skip processing this message
            }
          } catch (rateErr) {
            console.error("Rate limit check failed; proceeding without block", rateErr);
          }

          const result = await ctx.runAction(api.whatsapp.processMessage, {
            phoneNumber,
            message: messageText,
            messageId,
          });

          const replyRaw = typeof result?.response === "string" ? result.response : "✅ Received.";
          const reply = replyRaw.slice(0, 4000);
          await sendWhatsAppText(phoneNumber, reply);
        } catch (perMessageErr) {
          console.error("Error processing individual message", perMessageErr);
          // Try to notify the user once with a generic error, but don't throw
          try {
            const phoneNumber: string = msg?.from ?? "";
            if (phoneNumber) {
              await sendWhatsAppText(phoneNumber, "⚠️ Sorry, something went wrong. Please try again.");
            }
          } catch {
            // swallow
          }
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (err) {
      console.error("WhatsApp webhook error:", {
        message: (err as any)?.message ?? String(err),
        name: (err as any)?.name,
      });
      // Always 200 to avoid provider retries; errors are fully logged.
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }),
});

export default http;