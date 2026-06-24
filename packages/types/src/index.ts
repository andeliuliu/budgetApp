import { z } from "zod";

/**
 * Single source of truth for the budgetApp domain model.
 * Imported by both the NestJS API and the Expo app so the contract can't drift.
 */

/** User-facing spend buckets. Plaid's Personal Finance Categories map into these. */
export const CATEGORIES = [
  "grocery",
  "dining",
  "shopping",
  "investments",
  "savings",
  "rent",
  "utilities",
  "subscriptions",
  "loans",
  "transfers",
  "other",
] as const;

export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const accountSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  plaidAccountId: z.string(),
  name: z.string(),
  mask: z.string().nullable(),
  type: z.string(),
  subtype: z.string().nullable(),
  currentBalanceCents: z.number().int().nullable(),
  availableBalanceCents: z.number().int().nullable(),
});
export type Account = z.infer<typeof accountSchema>;

export const locationSchema = z.object({
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
});
export type Location = z.infer<typeof locationSchema>;

export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  plaidTransactionId: z.string(),
  /** Positive = money out (spend), negative = money in, in integer cents. */
  amountCents: z.number().int(),
  isoCurrency: z.string().default("USD"),
  date: z.string(), // ISO date (YYYY-MM-DD)
  datetime: z.string().nullable(), // ISO datetime when the bank provides it
  name: z.string(),
  merchantName: z.string().nullable(),
  category: categorySchema,
  pfcPrimary: z.string().nullable(),
  pfcDetailed: z.string().nullable(),
  location: locationSchema.nullable(),
  pending: z.boolean(),
  isTransfer: z.boolean().default(false),
  /** When a split exists, what I personally owe. Null = show full amount. */
  personalShareCents: z.number().int().nullable(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const splitTypeSchema = z.enum(["even", "manual"]);
export type SplitType = z.infer<typeof splitTypeSchema>;

export const splitParticipantStatusSchema = z.enum([
  "pending",
  "requested",
  "settled",
]);
export type SplitParticipantStatus = z.infer<
  typeof splitParticipantStatusSchema
>;

export const splitParticipantSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  venmoHandle: z.string().nullable(),
  amountOwedCents: z.number().int().nonnegative(),
  status: splitParticipantStatusSchema,
});
export type SplitParticipant = z.infer<typeof splitParticipantSchema>;

export const splitSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  type: splitTypeSchema,
  totalCents: z.number().int().nonnegative(),
  participants: z.array(splitParticipantSchema),
});
export type Split = z.infer<typeof splitSchema>;

export const budgetSchema = z.object({
  id: z.string().uuid(),
  category: categorySchema,
  period: z.string(), // "YYYY-MM"
  limitCents: z.number().int().nonnegative(),
});
export type Budget = z.infer<typeof budgetSchema>;

/** Request body for creating a split on a transaction. */
export const createSplitInputSchema = z.object({
  transactionId: z.string().uuid(),
  type: splitTypeSchema,
  participants: z
    .array(
      z.object({
        displayName: z.string().min(1),
        venmoHandle: z.string().nullable(),
        // Required for manual splits; ignored/recomputed for even splits.
        amountOwedCents: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1),
});
export type CreateSplitInput = z.infer<typeof createSplitInputSchema>;
