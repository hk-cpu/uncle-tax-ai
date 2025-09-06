import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      
      // UNCLE specific fields
      businessName: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      country: v.optional(v.union(v.literal("IN"), v.literal("SA"))),
      taxId: v.optional(v.string()),
      whatsappConnected: v.optional(v.boolean()),
    }).index("email", ["email"]) // index for the email. do not remove or modify
      .index("by_phone", ["phoneNumber"]),

    transactions: defineTable({
      userId: v.optional(v.id("users")),
      amount: v.number(),
      description: v.string(),
      type: v.union(v.literal("income"), v.literal("expense")),
      category: v.string(),
      taxRate: v.optional(v.number()),
      taxAmount: v.optional(v.number()),
      netAmount: v.number(),
      country: v.union(v.literal("IN"), v.literal("SA")),
      receiptUrl: v.optional(v.string()),
      whatsappMessageId: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
    }).index("by_user", ["userId"])
      .index("by_country", ["country"])
      .index("by_phone", ["phoneNumber"]),

    taxReports: defineTable({
      userId: v.id("users"),
      country: v.union(v.literal("IN"), v.literal("SA")),
      period: v.string(), // "2024-Q1", "2024-03", etc.
      reportType: v.union(v.literal("monthly"), v.literal("quarterly"), v.literal("annual")),
      totalIncome: v.number(),
      totalExpenses: v.number(),
      totalTax: v.number(),
      netProfit: v.number(),
      reportUrl: v.optional(v.string()),
      status: v.union(v.literal("draft"), v.literal("final"), v.literal("submitted")),
    }).index("by_user", ["userId"])
      .index("by_period", ["period"]),

    whatsappSessions: defineTable({
      phoneNumber: v.string(),
      userId: v.optional(v.id("users")),
      isActive: v.boolean(),
      lastMessageTime: v.number(),
      messageCount: v.number(),
    }).index("by_phone", ["phoneNumber"])
      .index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;