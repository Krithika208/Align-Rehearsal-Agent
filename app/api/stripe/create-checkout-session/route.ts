import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

const LOOKUP_KEY_BY_INTERVAL = {
  monthly: "align_monthly",
  annual: "align_annual",
} as const;

type BillingInterval = keyof typeof LOOKUP_KEY_BY_INTERVAL;

// Stripe statuses for a subscription that has fully ended.
const ENDED_STATUSES = ["canceled", "incomplete_expired"];

async function priceIdForLookupKey(lookupKey: string): Promise<string> {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error(`No active Stripe price found for lookup_key "${lookupKey}"`);
  }
  return price.id;
}

export async function POST(request: Request) {
  try {
    // Optional billing interval from the POST body; defaults to monthly.
    const body = (await request.json().catch(() => ({}))) as {
      billing_interval?: string;
    };
    const billingInterval: BillingInterval =
      body?.billing_interval === "annual" ? "annual" : "monthly";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to subscribe." },
        { status: 401 }
      );
    }

    // Block checkout only while a subscription is still running: active,
    // cancelling at period end (still "active" in Stripe) or payment overdue.
    // A fully ended plan goes through normal checkout again.
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("status, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && !ENDED_STATUSES.includes(existing.status)) {
      return NextResponse.json(
        {
          error: "You already have a subscription. Manage it from your account.",
          manage: "/account",
        },
        { status: 409 }
      );
    }

    const priceId = await priceIdForLookupKey(
      LOOKUP_KEY_BY_INTERVAL[billingInterval]
    );

    // Reuse the Stripe Customer: a returning customer's saved ID first, so
    // their billing history stays in one place, then a match on email.
    let customerId: string | null = existing?.stripe_customer_id || null;
    if (!customerId) {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      if (customers.data[0]) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
      }
    }

    const origin =
      request.headers.get("origin") ??
      new URL(request.url).origin;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app?subscription=success`,
      cancel_url: `${origin}/pricing?subscription=cancelled`,
      automatic_tax: { enabled: true },
      billing_address_collection: "auto",
      customer_update: { address: "auto" },
      metadata: {
        user_id: user.id,
        billing_interval: billingInterval,
      },
      subscription_data: { metadata: { user_id: user.id } },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Could not start checkout. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[create-checkout-session] error:", error);
    return NextResponse.json(
      { error: "Pricing is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
