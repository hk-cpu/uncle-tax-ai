import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Break potential type circularities when referencing internal functions within this module
const internalAny: any = internal;

export const processMessage = action({
  args: {
    phoneNumber: v.string(),
    message: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const text = args.message.trim();
      const lower = text.toLowerCase();

      // Basic validation & guardrails
      if (!text) {
        return { success: false, response: "Please send a valid text message." };
      }
      if (text.length > 1000) {
        return { success: false, response: "Your message is too long. Please keep it under 1000 characters." };
      }

      if (lower.startsWith("undo")) {
        try {
          const res = await ctx.runMutation(internalAny.whatsapp.deleteLastByPhone, { phoneNumber: args.phoneNumber });
          if (res.deleted) {
            return {
              success: true,
              response: `↩️ Undone: ${res.type} of ${res.amount} (${res.description})`,
            };
          }
          return { success: false, response: "Nothing to undo." };
        } catch (err) {
          console.error("undo command failed", err);
          return { success: false, response: "⚠️ Couldn't undo. Please try again." };
        }
      }

      if (lower.startsWith("balance")) {
        try {
          const s = await ctx.runMutation(internalAny.whatsapp.getSummaryByPhone, { phoneNumber: args.phoneNumber });
          return {
            success: true,
            response: `📊 Balance\nIncome: ${s.totalIncome}\nExpenses: ${s.totalExpenses}\nTax: ${s.totalTax}\nNet: ${s.net}`,
          };
        } catch (err) {
          console.error("balance command failed", err);
          return { success: false, response: "⚠️ Couldn't fetch balance. Try later." };
        }
      }

      const parsedTransaction = await parseTransactionMessage(args.message);

      if (parsedTransaction) {
        try {
          await ctx.runMutation(internalAny.whatsapp.createFromWhatsApp, {
            ...parsedTransaction,
            whatsappMessageId: args.messageId,
            phoneNumber: args.phoneNumber,
          });

          return {
            success: true,
            response: `✅ Recorded: ${parsedTransaction.type} of ${parsedTransaction.amount} (${parsedTransaction.category})`,
          };
        } catch (err) {
          console.error("createFromWhatsApp failed", err);
          return { success: false, response: "⚠️ Failed to record the transaction. Please try again." };
        }
      }

      return {
        success: false,
        response:
          "I couldn't understand that. Try:\n- Sold 5 items for ₹500\n- Bought supplies ₹200\nCommands: undo, balance",
      };
    } catch (err) {
      console.error("processMessage unexpected error", err);
      return { success: false, response: "⚠️ Unexpected error. Please try again." };
    }
  },
});

type ParsedTransaction = {
  amount: number;
  description: string;
  type: "income" | "expense";
  category: string;
  country: "IN" | "SA";
  taxRate?: number;
};

async function parseTransactionMessage(message: string): Promise<ParsedTransaction | null> {
  const text = message.trim();
  const lower = text.toLowerCase();

  // Determine country by symbol or hint
  const hasIN = /₹|inr|india| gst\b/i.test(text);
  const hasSA = /﷼|sar|saudi| vat\b/i.test(text);

  // Extract amount: supports 2,500.75 or 2.5k formats and currency symbols
  const amountMatch =
    text.match(/(?:₹|﷼|\bINR\b|\bSAR\b)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)(\s*[kK])?/) ||
    undefined;

  const getAmount = (): number | null => {
    if (!amountMatch) return null;
    const base = amountMatch[1].replace(/,/g, "");
    let amt = parseFloat(base);
    if (isNaN(amt)) return null;
    if (amountMatch[2]) amt *= 1000; // 'k' suffix
    return Math.round((amt + Number.EPSILON) * 100) / 100;
  };

  const amount = getAmount();

  // Simple classifiers
  const isIncome = /(sold|sale|received|income|paid to me)/i.test(text);
  const isExpense = /(bought|purchase|spent|expense|paid\b(?! to me))/i.test(text);

  if (amount && (isIncome || isExpense)) {
    const country = hasSA ? "SA" : hasIN ? "IN" : ("IN" as const);
    return {
      amount,
      description: text,
      type: isIncome ? "income" : ("expense" as const),
      category: isIncome ? "sales" : "purchases",
      country,
      taxRate: country === "IN" ? (isIncome ? 18 : 0) : country === "SA" ? (isIncome ? 15 : 0) : 0,
    };
  }

  // Fallback simple patterns
  const patterns = [/sold.*?\b(\d+(?:,\d{3})*(?:\.\d+)?)\b/i, /bought.*?\b(\d+(?:,\d{3})*(?:\.\d+)?)\b/i];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const amt = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(amt)) {
        const country = hasSA ? "SA" : hasIN ? "IN" : ("IN" as const);
        const inc = /sold/i.test(text);
        return {
          amount: amt,
          description: text,
          type: inc ? "income" : ("expense" as const),
          category: inc ? "sales" : "purchases",
          country,
          taxRate: country === "IN" ? (inc ? 18 : 0) : country === "SA" ? (inc ? 15 : 0) : 0,
        };
      }
    }
  }

  return null;
}

export const getSummaryByPhone = internalMutation({
  // Using mutation to keep single place to read+act if needed later (Convex allows reads from mutations)
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("transactions")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .collect();

    const totalIncome = results.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpenses = results.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalTax = results.reduce((s, t) => s + (t.taxAmount ?? 0), 0);

    return {
      totalIncome,
      totalExpenses,
      totalTax,
      net: totalIncome - totalExpenses,
      count: results.length,
    };
  },
});

export const deleteLastByPhone = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    try {
      let last: any = null;
      const query = ctx.db.query("transactions").withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber));
      for await (const row of query) {
        if (!last || row._creationTime > last._creationTime) last = row;
      }
      if (last) {
        await ctx.db.delete(last._id);
        return { deleted: true, description: last.description, amount: last.amount, type: last.type };
      }
      return { deleted: false };
    } catch (err) {
      console.error("deleteLastByPhone failed", err);
      return { deleted: false };
    }
  },
});

export const createFromWhatsApp = internalMutation({
  args: {
    amount: v.number(),
    description: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    country: v.union(v.literal("IN"), v.literal("SA")),
    taxRate: v.optional(v.number()),
    whatsappMessageId: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by phone number or create anonymous transaction
    const taxAmount = args.taxRate ? (args.amount * args.taxRate) / 100 : 0;
    
    return await ctx.db.insert("transactions", {
      ...args,
      userId: undefined, // Will be linked when user signs up
      taxAmount,
      netAmount: args.type === "income" ? args.amount - taxAmount : args.amount,
    });
  },
});

export const checkRateLimit = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const WINDOW_MS = 60_000; // 1 minute
    const LIMIT = 15;

    let session: any = null;
    const q = ctx.db.query("whatsappSessions").withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber));
    // Get first session if exists
    for await (const row of q) {
      session = row;
      break;
    }

    const now = Date.now();

    // Create a new session if none
    if (!session) {
      await ctx.db.insert("whatsappSessions", {
        phoneNumber: args.phoneNumber,
        userId: undefined,
        isActive: true,
        lastMessageTime: now,
        messageCount: 1,
      });
      return { blocked: false as const };
    }

    const elapsed = now - session.lastMessageTime;
    if (elapsed > WINDOW_MS) {
      // Reset window
      await ctx.db.patch(session._id, {
        lastMessageTime: now,
        messageCount: 1,
      });
      return { blocked: false as const };
    }

    const nextCount = (session.messageCount ?? 0) + 1;
    if (nextCount > LIMIT) {
      const retryAfterMs = Math.max(0, WINDOW_MS - elapsed);
      // Keep the existing window; do not increment count further
      return { blocked: true as const, retryAfterMs };
    }

    await ctx.db.patch(session._id, {
      lastMessageTime: now,
      messageCount: nextCount,
    });

    return { blocked: false as const };
  },
});