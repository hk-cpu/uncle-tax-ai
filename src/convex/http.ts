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
    console.warn("[WA][send] Missing env: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return;
  }

  const safeTo = String(to ?? "").trim();
  const safeBody = String(body ?? "").slice(0, 4000).trim();

  if (!safeTo) {
    console.warn("[WA][send] Skipped: empty recipient");
    return;
  }
  if (!safeBody) {
    console.warn("[WA][send] Skipped: empty body");
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  // Use POST helper with retry + timeout
  const res = await postJsonWithRetry(url, {
    messaging_product: "whatsapp",
    to: safeTo,
    type: "text",
    text: { body: safeBody },
  }, {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  if (!res) {
    console.error("[WA][send] request failed after retries");
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[WA][send] final failure", {
      status: res.status,
      statusText: res.statusText,
      body: text?.slice?.(0, 1000),
    });
    return;
  }

  console.info("[WA][send] ok", { to: maskPhone(safeTo), len: safeBody.length });
}

// Small helper to avoid logging raw numbers
function maskPhone(n: string) {
  if (n.length <= 4) return "***";
  return `${"*".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;
}

// Add: generic POST helper with timeout + retries and structured logging
async function postJsonWithRetry(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  opts?: { attempts?: number; timeoutMs?: number; backoffMs?: number }
): Promise<Response | null> {
  const attempts = Math.max(1, opts?.attempts ?? 2);
  const timeoutMs = Math.max(1000, opts?.timeoutMs ?? 8000);
  const backoffMs = Math.max(100, opts?.backoffMs ?? 400);

  for (let i = 1; i <= attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(t);

      // Retry only on 5xx
      if (!res.ok && res.status >= 500 && i < attempts) {
        console.warn("[fetch][retry]", { url: safeUrl(url), attempt: i, status: res.status });
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(t);
      const aborted = err?.name === "AbortError";
      console.error("[fetch][error]", { url: safeUrl(url), attempt: i, aborted, err: String(err) });
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  return null;
}

// Add Web Crypto HMAC-SHA256 helper to replace node:crypto usage
async function hmacSha256Hex(secret: string, data: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return toHex(new Uint8Array(signature));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Hide query params when logging
function safeUrl(u: string) {
  try {
    const parsed = new URL(u);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return u;
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

// Strengthen: signature verification + raw body handling for POST
http.route({
  path: "/webhooks/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Read raw bytes first for signature verification
    let bytes: Uint8Array;
    try {
      const ab = await req.arrayBuffer();
      bytes = new Uint8Array(ab);
    } catch (e) {
      console.error("[WA][webhook] Failed to read request body bytes", e);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // Optional signature verification if app secret is present
    try {
      const appSecret = process.env.WHATSAPP_APP_SECRET;
      const sigHeader = req.headers.get("x-hub-signature-256");
      if (appSecret) {
        if (!sigHeader) {
          console.warn("[WA][sig] Missing x-hub-signature-256 header; rejecting");
          return new Response("Forbidden", { status: 403 });
        }
        // Compute HMAC-SHA256 using Web Crypto (no Node API)
        const hexSig = await hmacSha256Hex(appSecret, bytes);
        const expected = "sha256=" + hexSig;
        const valid = timingSafeEqual(expected, sigHeader);
        if (!valid) {
          console.warn("[WA][sig] Signature mismatch; rejecting");
          return new Response("Forbidden", { status: 403 });
        }
      } else {
        console.warn("[WA][sig] WHATSAPP_APP_SECRET not set; skipping signature verification");
      }
    } catch (sigErr) {
      console.error("[WA][sig] Verification error", sigErr);
      return new Response("Forbidden", { status: 403 });
    }

    // Parse JSON from raw bytes
    let body: any = null;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch (parseErr) {
      console.error("[WA][webhook] JSON parse error", parseErr);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    try {
      // Structured context logging (no PII)
      const entry = Array.isArray(body?.entry) ? body.entry[0] : null;
      const changes = Array.isArray(entry?.changes) ? entry.changes[0] : null;
      const value = changes?.value ?? null;

      if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
        // Delivery/read receipts
        console.info("[WA][webhook] Status update received");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const messages = Array.isArray(value?.messages) ? value.messages : [];
      if (!messages.length) {
        console.info("[WA][webhook] No messages in payload");
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      for (const msg of messages) {
        try {
          if (msg?.type !== "text") {
            console.info("[WA][msg] Ignoring non-text message");
            continue;
          }

          const messageId: string = msg.id ?? "";
          const messageText: string = msg.text?.body ?? "";
          const phoneNumber: string = msg.from ?? "";

          if (!messageId || !messageText || !phoneNumber) {
            console.warn("[WA][msg] Malformed message fields", {
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
              await sendWhatsAppText(phoneNumber, `⏱️ Please slow down. Try again in ${waitSec}s.`);
              console.warn("[WA][rl] Blocked", { phone: maskPhone(phoneNumber), retryAfterSec: waitSec });
              continue;
            }
          } catch (rateErr) {
            console.error("[WA][rl] Check failed; proceeding", rateErr);
          }

          const result = await ctx.runAction(api.whatsapp.processMessage, {
            phoneNumber,
            message: messageText,
            messageId,
          });

          const replyRaw = typeof result?.response === "string" ? result.response : "✅ Received.";
          const reply = replyRaw.slice(0, 4000);
          await sendWhatsAppText(phoneNumber, reply);

          console.info("[WA][msg] Processed", {
            id: messageId,
            phone: maskPhone(phoneNumber),
            replyLen: reply.length,
          });
        } catch (perMessageErr) {
          console.error("[WA][msg] Processing error", perMessageErr);
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
      console.error("[WA][webhook] Handler error", err);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }),
});

// Timing-safe string comparison for signatures
function timingSafeEqual(a: string, b: string) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  // XOR compare to avoid early exit timing: simple constant-time-ish compare
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export default http;