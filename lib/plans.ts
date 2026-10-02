// Plan limits and shared types, safe to import from client components.

export const FREE_SESSION_LIMIT = 5;
export const PAID_MONTHLY_FAIR_USE_CAP = 30;

export type FoundingPerk = {
  claimed: boolean;
  claimed_at: string | null;
};
