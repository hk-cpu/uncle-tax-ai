import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";
import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

export const linkTransactionsByPhone = internalMutation({
  args: { userId: v.id("users"), phoneNumber: v.string() },
  handler: async (ctx, args) => {
    // Link historical transactions that were created from WhatsApp before signup
    const q = ctx.db
      .query("transactions")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber));
    for await (const row of q) {
      // Only link if not already linked
      if (!row.userId) {
        await ctx.db.patch(row._id, { userId: args.userId });
      }
    }
    return null;
  },
});

export const updateWhatsAppConnection = mutation({
  args: {
    phoneNumber: v.string(),
    connected: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const phone = args.phoneNumber.trim();
    if (!phone) throw new Error("Phone number required");

    await ctx.db.patch(user._id, {
      phoneNumber: phone,
      whatsappConnected: args.connected ?? true,
    });

    // Backfill link transactions created via WhatsApp for this number
    await ctx.runMutation(internal.users.linkTransactionsByPhone, {
      userId: user._id,
      phoneNumber: phone,
    });

    return { success: true };
  },
});