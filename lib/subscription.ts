import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionTier = "founding" | "standard";
export type BillingInterval = "monthly" | "annual";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_subscription_schedule_id: string | null;
  tier: SubscriptionTier;
  status: string;
  billing_interval: BillingInterval | null;
  founding_member: boolean;
  founding_locked_until: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionInfo = {
  active: boolean;
  tier: SubscriptionTier | null;
  billingInterval: BillingInterval | null;
  status: string;
  subscription: SubscriptionRow | null;
};

const ACTIVE_STATUSES = ["active", "trialing"];

// Fetch the signed-in user's subscription row. Returns a neutral "none" state
// when the user is signed out or has no subscription yet.
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      active: false,
      tier: null,
      billingInterval: null,
      status: "none",
      subscription: null,
    };
  }

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return {
      active: false,
      tier: null,
      billingInterval: null,
      status: "none",
      subscription: null,
    };
  }

  const row = data as SubscriptionRow;
  return {
    active: ACTIVE_STATUSES.includes(row.status),
    tier: row.tier,
    billingInterval: row.billing_interval,
    status: row.status,
    subscription: row,
  };
}

// Gate for /app and its rehearsal routes. Assumes the middleware has already
// ensured the user is signed in. Redirects (server-side, before render, so no
// flicker) when the user isn't entitled to the app experience.
export async function requireActiveSubscription(): Promise<SubscriptionInfo> {
  const info = await getSubscriptionInfo();

  if (info.status === "past_due" || info.status === "incomplete") {
    redirect("/account?reason=payment_issue");
  }

  if (!info.active) {
    redirect("/pricing?reason=subscribe");
  }

  return info;
}
