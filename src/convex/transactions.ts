import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const create = mutation({
  args: {
    amount: v.number(),
    description: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    taxRate: v.optional(v.number()),
    country: v.union(v.literal("IN"), v.literal("SA")),
    receiptUrl: v.optional(v.string()),
    whatsappMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    const taxAmount = args.taxRate ? (args.amount * args.taxRate) / 100 : 0;
    
    return await ctx.db.insert("transactions", {
      ...args,
      userId: user._id,
      taxAmount,
      netAmount: args.type === "income" ? args.amount - taxAmount : args.amount,
    });
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    country: v.optional(v.union(v.literal("IN"), v.literal("SA"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    let query = ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc");

    if (args.country) {
      query = query.filter((q) => q.eq(q.field("country"), args.country));
    }

    return await query.take(args.limit || 50);
  },
});

export const getTaxSummary = query({
  args: {
    country: v.union(v.literal("IN"), v.literal("SA")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("country"), args.country))
      .collect();

    const filtered = transactions.filter((t) => {
      if (args.startDate && t._creationTime < args.startDate) return false;
      if (args.endDate && t._creationTime > args.endDate) return false;
      return true;
    });

    const totalIncome = filtered
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = filtered
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalTax = filtered.reduce((sum, t) => sum + (t.taxAmount || 0), 0);

    return {
      totalIncome,
      totalExpenses,
      totalTax,
      netProfit: totalIncome - totalExpenses,
      transactionCount: filtered.length,
    };
  },
});
