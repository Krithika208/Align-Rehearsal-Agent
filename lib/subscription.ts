import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FREE_SESSION_LIMIT, type FoundingPerk } from "@/lib/plans";

export type SubscriptionTier = "standard";
export type BillingInterval = "monthly" | "annual";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  tier: SubscriptionTier;
  status: string;
  billing_interval: BillingInterval | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionInfo = {
  active: boolean;
  tier: SubscriptionTier | null;
  status: string;
  billingInterval: BillingInterval | null;
  subscription: SubscriptionRow | null;
};

const ACTIVE_STATUSES = ["active", "trialing"];
const PAYMENT_ISSUE_STATUSES = ["past_due", "incomplete"];

const NO_SUBSCRIPTION: SubscriptionInfo = {
  active: false,
  tier: null,
  status: "none",
  billingInterval: null,
  subscription: null,
};

export function isPaymentIssue(status: string): boolean {
  return PAYMENT_ISSUE_STATUSES.includes(status);
}

// Fetch the signed-in user's subscription row. Returns a neutral "none" state
// when the user is signed out or has no subscription yet.
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NO_SUBSCRIPTION;

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return NO_SUBSCRIPTION;

  const row = data as SubscriptionRow;
  return {
    active: ACTIVE_STATUSES.includes(row.status),
    tier: "standard",
    status: row.status,
    billingInterval: row.billing_interval,
    subscription: row,
  };
}

// How many of their 5 lifetime free rehearsals the signed-in user has used.
export async function getFreeSessionsUsed(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("usage_counters")
    .select("free_sessions_used")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.free_sessions_used ?? 0;
}

// The signed-in user's founding perk, or null if they don't have one.
export async function getFoundingPerk(): Promise<FoundingPerk | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("founding_perks")
    .select("claimed, claimed_at, booking_ref")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ?? null;
}

// Gate for /app. Assumes the middleware has already ensured the user is signed
// in. Paid users go straight through; free users go through while they have
// free rehearsals left. Redirects server-side, before render, so no flicker.
export async function requireAppAccess(): Promise<{
  info: SubscriptionInfo;
  freeSessionsUsed: number | null;
}> {
  const info = await getSubscriptionInfo();

  if (isPaymentIssue(info.status)) {
    redirect("/account?reason=payment_issue");
  }

  if (info.active) {
    return { info, freeSessionsUsed: null };
  }

  const freeSessionsUsed = await getFreeSessionsUsed();
  if (freeSessionsUsed >= FREE_SESSION_LIMIT) {
    redirect("/pricing?reason=free_limit_reached");
  }

  return { info, freeSessionsUsed };
}
