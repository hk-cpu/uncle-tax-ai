/* removed "use node" directive */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = typeof (globalThis as any).__httpRouter !== "undefined"
  ? (globalThis as any).__httpRouter
  : (globalThis as any).__httpRouter = httpRouter();

// Helper to send a WhatsApp message via Meta Graph API
async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("WhatsApp send skipped: missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return;
  }

  // Ensure recipient and body are safe, non-empty strings
  const safeTo = String(to ?? "").trim();
  const safeBody = String(body ?? "").slice(0, 4000).trim();

  if (!safeTo) {
    console.warn("WhatsApp send skipped: empty 'to' phone number");
    return;
  }
  if (!safeBody) {
    console.warn("WhatsApp send skipped: empty message body");
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
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
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("WhatsApp send failed", { status: res.status, statusText: res.statusText, body: text });
    }
  } catch (err) {
    console.error("WhatsApp send error", err);
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
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body?.entry)) {
        console.warn("Webhook received invalid body");
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
      console.error("WhatsApp webhook error:", err);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }),
});

export default http;