/* removed "use node" directive */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

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

// Add helpers for signature verification and consistent logging
function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time comparison
function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function verifyWhatsAppSignature(appSecret: string, body: ArrayBuffer, headerSig: string | null) {
  try {
    if (!headerSig || !headerSig.startsWith("sha256=")) return false;
    const provided = headerSig.slice("sha256=".length);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, body);
    const expected = toHex(new Uint8Array(mac));
    return timingSafeEqualHex(provided, expected);
  } catch (e) {
    console.error("whatsapp.signature.verify_error", e);
    return false;
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
    // Enhanced: verify X-Hub-Signature-256 if WHATSAPP_APP_SECRET is set
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const sigHeader = req.headers.get("x-hub-signature-256");
    const bodyBuf = await req.arrayBuffer();

    if (appSecret) {
      const ok = await verifyWhatsAppSignature(appSecret, bodyBuf, sigHeader);
      if (!ok) {
        console.warn("whatsapp.webhook.signature_invalid", {
          hasHeader: !!sigHeader,
          bodyLen: bodyBuf.byteLength,
        });
        return new Response("Invalid signature", { status: 403 });
      }
    } else {
      console.warn("whatsapp.webhook.signature_skipped_missing_secret");
    }

    try {
      const bodyText = new TextDecoder().decode(bodyBuf);
      let body: any = null;
      try {
        body = JSON.parse(bodyText);
      } catch {
        console.warn("whatsapp.webhook.invalid_json", { bodyLen: bodyText.length });
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (!body || !Array.isArray(body?.entry)) {
        console.warn("whatsapp.webhook.invalid_body_shape");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const entry = body.entry[0];
      const changes = Array.isArray(entry?.changes) ? entry.changes[0] : null;
      const value = changes?.value ?? null;

      console.log("whatsapp.webhook.received", {
        entryId: entry?.id,
        messagingProduct: value?.messaging_product,
        statuses: Array.isArray(value?.statuses) ? value.statuses.length : 0,
        messages: Array.isArray(value?.messages) ? value.messages.length : 0,
      });

      // Handle status updates (delivery/read receipts)
      if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const messages = Array.isArray(value?.messages) ? value.messages : [];
      if (!messages.length) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      for (const msg of messages) {
        try {
          if (msg?.type !== "text") {
            console.log("whatsapp.webhook.skip_non_text", { messageId: msg?.id, type: msg?.type });
            continue;
          }

          const messageId: string = msg.id ?? "";
          const messageText: string = msg.text?.body ?? "";
          const phoneNumber: string = msg.from ?? "";

          if (!messageId || !messageText || !phoneNumber) {
            console.warn("whatsapp.webhook.malformed_message", {
              hasId: !!messageId,
              hasText: !!messageText,
              hasFrom: !!phoneNumber,
            });
            continue;
          }

          // Rate limit per phone number before any processing
          try {
            const rl = await ctx.runMutation(internal.whatsapp.checkRateLimit, { phoneNumber });
            if (rl?.blocked) {
              const waitSec = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
              console.warn("whatsapp.rate_limited", { phoneNumber, waitSec });
              await sendWhatsAppText(
                phoneNumber,
                `⏱️ Please slow down. Try again in ${waitSec}s.`
              );
              continue;
            }
          } catch (rateErr) {
            console.error("whatsapp.rate_limit_check_error", rateErr);
          }

          console.log("whatsapp.process.start", {
            phoneNumber,
            messageId,
            preview: messageText.slice(0, 80),
          });

          const result = await ctx.runAction(api.whatsapp.processMessage, {
            phoneNumber,
            message: messageText,
            messageId,
          });

          const replyRaw = typeof result?.response === "string" ? result.response : "✅ Received.";
          const reply = replyRaw.slice(0, 4000);

          await sendWhatsAppText(phoneNumber, reply);

          console.log("whatsapp.process.success", {
            phoneNumber,
            messageId,
            success: !!result?.success,
          });
        } catch (perMessageErr) {
          console.error("whatsapp.process.error", {
            error: (perMessageErr as Error)?.message ?? String(perMessageErr),
            stack: (perMessageErr as Error)?.stack,
            messageId: msg?.id,
            from: msg?.from,
          });
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
      console.error("whatsapp.webhook.handler_error", {
        error: (err as Error)?.message ?? String(err),
        stack: (err as Error)?.stack,
      });
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }),
});

export default http;