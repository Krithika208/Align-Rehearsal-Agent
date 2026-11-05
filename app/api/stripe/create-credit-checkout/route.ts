import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { CREDIT_PACKS, isCreditPackId } from "@/lib/plans";

// One-off Checkout (payment mode) for a credit pack. The webhook adds the
// credits once Stripe confirms payment; nothing is granted here.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { pack?: unknown };
    if (!isCreditPackId(body.pack)) {
      return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
    }
    const pack = CREDIT_PACKS[body.pack];

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to buy rehearsals." },
        { status: 401 }
      );
    }

    const prices = await stripe.prices.list({
      lookup_keys: [pack.lookupKey],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) {
      throw new Error(`No active Stripe price found for lookup_key "${pack.lookupKey}"`);
    }

    // Reuse the Stripe Customer, as subscription checkout does: the saved ID
    // first, then a match on email, else a new one.
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    let customerId: string | null = existing?.stripe_customer_id || null;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
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

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/account?purchase=success`,
      cancel_url: `${origin}/account?purchase=cancelled`,
      automatic_tax: { enabled: true },
      billing_address_collection: "auto",
      customer_update: { address: "auto" },
      metadata: {
        user_id: user.id,
        credit_pack: body.pack,
        credits: String(pack.credits),
      },
      payment_intent_data: { metadata: { user_id: user.id, credit_pack: body.pack } },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Could not start checkout. Please try again." },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[create-credit-checkout] error:", error);
    return NextResponse.json(
      { error: "Buying rehearsals is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
