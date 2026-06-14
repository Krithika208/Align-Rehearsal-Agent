import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

const FOUNDING_CAP = 100;
const FOUNDING_LOOKUP_KEY = "align_founding_monthly";
const STANDARD_LOOKUP_KEY = "align_standard_monthly";

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

  // Already subscribed? Send them to manage it rather than double-charging.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: "You already have a subscription. Manage it from your account.",
        manage: "/app",
      },
      { status: 409 }
    );
  }

  // Decide tier. The founding count is read atomically via a SECURITY DEFINER
  // RPC; the UNIQUE(user_id) constraint plus the webhook insert are the real
  // backstop, so this is a best-effort gate on the 100-spot cap at checkout time.
  const { data: foundingCount, error: countError } = await supabase.rpc(
    "get_founding_count"
  );
  if (countError) {
    return NextResponse.json(
      { error: "Could not determine pricing. Please try again." },
      { status: 500 }
    );
  }

  const isFounding = (foundingCount ?? 0) < FOUNDING_CAP;
  const lookupKey = isFounding ? FOUNDING_LOOKUP_KEY : STANDARD_LOOKUP_KEY;

  let priceId: string;
  try {
    priceId = await priceIdForLookupKey(lookupKey);
  } catch {
    return NextResponse.json(
      { error: "Pricing is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }

  // Create or reuse the Stripe Customer for this user.
  let customerId: string;
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
      founding_member: isFounding ? "true" : "false",
    },
    subscription_data: isFounding
      ? { metadata: { user_id: user.id, will_transition: "true" } }
      : { metadata: { user_id: user.id } },
  });

  if (!checkoutSession.url) {
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: checkoutSession.url });
}
