import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const processMessage = action({
  args: {
    phoneNumber: v.string(),
    message: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    // Parse transaction from WhatsApp message using AI
    const parsedTransaction = await parseTransactionMessage(args.message);
    
    if (parsedTransaction) {
      // Create transaction in database
      await ctx.runMutation(internal.whatsapp.createFromWhatsApp, {
        ...parsedTransaction,
        whatsappMessageId: args.messageId,
        phoneNumber: args.phoneNumber,
      });

      // Send confirmation back to WhatsApp
      return {
        success: true,
        response: `✅ Transaction recorded: ${parsedTransaction.type} of ${parsedTransaction.amount} for ${parsedTransaction.description}`,
      };
    }

    return {
      success: false,
      response: "I couldn't understand that transaction. Please try: 'Sold 5 items for ₹500' or 'Bought supplies ₹200'",
    };
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
  // Simple regex-based parsing for demo
  const patterns = [
    /sold.*?(\d+).*?for.*?₹?(\d+)/i,
    /income.*?₹?(\d+)/i,
    /bought.*?₹?(\d+)/i,
    /expense.*?₹?(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const amount = parseInt(match[match.length - 1]);
      const isIncome = /sold|income|received/i.test(message);
      
      return {
        amount,
        description: message.trim(),
        type: isIncome ? "income" : "expense" as const,
        category: isIncome ? "sales" : "purchases",
        country: "IN" as const,
        taxRate: isIncome ? 18 : 0, // GST for income in India
      };
    }
  }

  return null;
}

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