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
    // Silently skip sending if not configured, but don't explode the webhook
    console.warn("WhatsApp send skipped: missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
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
        to,
        type: "text",
        text: { body },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("WhatsApp send error:", res.status, text.slice(0, 500));
    }
  } catch (err) {
    console.error("WhatsApp send network error:", err);
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
      if (!body || typeof body !== "object") {
        console.warn("Invalid webhook payload");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // Structure per WhatsApp Cloud API
      // body.entry[].changes[].value.messages[]
      const entry = Array.isArray((body as any)?.entry) ? (body as any).entry[0] : null;
      const changes = Array.isArray(entry?.changes) ? entry.changes[0] : null;
      const value = changes?.value ?? null;
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      // If no messages, just ack
      if (!messages.length) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      for (const msg of messages) {
        try {
          // Only handle text messages for now
          if (msg?.type !== "text") continue;

          const messageId: string = msg.id ?? "";
          const messageText: string = msg.text?.body ?? "";
          // "from" contains the sender phone number in international format
          const phoneNumber: string = msg.from ?? "";

          if (!messageId || !messageText || !phoneNumber) {
            console.warn("Skipping message: missing fields", { messageId, hasText: !!messageText, phoneNumber });
            continue;
          }

          // Process via existing action
          const result = await ctx.runAction(api.whatsapp.processMessage, {
            phoneNumber,
            message: messageText,
            messageId,
          });

          // Reply back to user
          const reply = result?.response || "✅ Received.";
          await sendWhatsAppText(phoneNumber, reply);
        } catch (innerErr) {
          console.error("Error handling individual message:", innerErr);
          // Continue processing any remaining messages
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (err) {
      console.error("WhatsApp webhook error:", err);
      // Always return 200 to avoid webhook disablement, but log errors
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }),
});

export default http;