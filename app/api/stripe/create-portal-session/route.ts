import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to manage billing." },
        { status: 401 }
      );
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No subscription found for your account." },
        { status: 404 }
      );
    }

    const origin =
      request.headers.get("origin") ?? new URL(request.url).origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("[create-portal-session] error:", error);
    return NextResponse.json(
      { error: "Could not open billing. Please try again." },
      { status: 500 }
    );
  }
}
