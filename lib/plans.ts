// Plan limits and shared types, safe to import from client components.

export const FREE_SESSION_LIMIT = 3;
export const PAID_MONTHLY_FAIR_USE_CAP = 30;

export type FoundingPerk = {
  claimed: boolean;
  claimed_at: string | null;
  booking_ref: string;
};

// Pay-as-you-go credit packs. One credit = one rehearsal. Credits never expire.
// Prices live in Stripe, found by lookup key; the amounts here are for labels.
export type CreditPackId = "single" | "pack_5";

export const CREDIT_PACKS: Record<
  CreditPackId,
  { lookupKey: string; credits: number; label: string }
> = {
  single: { lookupKey: "rehearsal_single", credits: 1, label: "Buy 1 rehearsal ($5)" },
  pack_5: { lookupKey: "rehearsal_pack_5", credits: 5, label: "Buy 5 rehearsals ($20)" },
};

export function isCreditPackId(value: unknown): value is CreditPackId {
  return value === "single" || value === "pack_5";
}

// A paid rehearsal that ends sooner than this gets its credit back.
export const CREDIT_REFUND_UNDER_SECONDS = 60;
