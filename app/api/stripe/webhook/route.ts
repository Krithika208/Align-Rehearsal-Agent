import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { scheduleFoundingWelcomeEmail } from "@/lib/emails/founding-welcome";
import { CREDIT_PACKS, isCreditPackId } from "@/lib/plans";

// Stripe webhooks need the byte-exact raw body for signature verification.
// Force the Node.js runtime and opt out of static optimization / body parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Both current prices are the single "standard" tier; the lookup key tells us
// the billing interval.
const INTERVAL_BY_LOOKUP_KEY: Record<string, "monthly" | "annual"> = {
  align_monthly: "monthly",
  align_annual: "annual",
};

// In the current API version the subscription id lives on the invoice's parent.
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

function lookupKeyFromSubscription(
  subscription: Stripe.Subscription
): string | null {
  return subscription.items.data[0]?.price.lookup_key ?? null;
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

// Adds the credits for a paid one-off Checkout session. Idempotent: the
// ledger allows one row per Checkout session id, so a repeated webhook hits
// the unique constraint and grants nothing more.
async function grantCredits(supabase: ServiceClient, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return; // async payment still pending

  const userId = session.metadata?.user_id;
  const packId = session.metadata?.credit_pack;
  if (!userId || !isCreditPackId(packId)) {
    console.error(`[stripe-webhook] credit session ${session.id} has no user or pack`);
    return;
  }

  const { error } = await supabase.from("credit_ledger").insert({
    user_id: userId,
    delta: CREDIT_PACKS[packId].credits,
    reason: "purchase",
    stripe_checkout_session_id: session.id,
  });
  if (error && error.code !== "23505") {
    throw new Error(`Failed to grant credits: ${error.message}`);
  }
}

export async function POST(request: Request) {
  // Read the byte-exact raw body. Using an ArrayBuffer → Buffer (rather than
  // request.text()) preserves the exact bytes Stripe signed, avoiding any
  // text re-encoding that breaks signature verification under the App Router.
  const rawBody = await request.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      bodyBuffer,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[stripe-webhook] signature verification failed:", message);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      // A delayed payment method (e.g. bank debit) confirmed later.
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.mode === "payment") await grantCredits(supabase, session);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;
        // One-off credit purchase. No subscription, no founding perk.
        if (session.mode === "payment") {
          await grantCredits(supabase, session);
          break;
        }
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) break;

        const userId = session.metadata?.user_id;
        if (!userId) break;

        const rawInterval = session.metadata?.billing_interval;
        const billingInterval =
          rawInterval === "monthly" || rawInterval === "annual"
            ? rawInterval
            : null;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        // One row per user. A returning customer's ended subscription is
        // replaced by the new one, so /account and the app see them as Pro.
        const { error: insertError } = await supabase
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId ?? "",
              stripe_subscription_id: subscriptionId,
              tier: "standard",
              status: "active",
              billing_interval: billingInterval,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (insertError) {
          throw new Error(`Failed to insert subscription: ${insertError.message}`);
        }

        // First 100 paid users get a founding perk. The RPC returns the user's
        // existing slot if they already have one, so a retried webhook never
        // allocates twice or burns a second slot. It reports allocated: true in
        // both cases, so check first whether the user already had a slot.
        const { data: existingPerk } = await supabase
          .from("founding_perks")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: perk, error: perkError } = await supabase.rpc(
          "allocate_founding_perk",
          { p_user_id: userId }
        );
        if (perkError) {
          throw new Error(`Failed to allocate founding perk: ${perkError.message}`);
        }

        // Newly allocated slot only (never position 101+, never an existing
        // member, never a webhook retry): schedule Krithika's welcome note.
        // Best-effort: a failure is logged and the webhook still succeeds.
        if (!existingPerk && (perk as { allocated?: boolean } | null)?.allocated) {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(userId);
            const email = authUser.user?.email;
            if (!email) throw new Error("user has no email address");
            // user_metadata is auth.users.raw_user_meta_data; full_name is what
            // the signup form collects.
            await scheduleFoundingWelcomeEmail({
              userId,
              email,
              displayName: authUser.user?.user_metadata?.full_name,
            });
          } catch (emailError) {
            console.error(
              `[stripe-webhook] founding welcome email not scheduled for ${userId}:`,
              emailError instanceof Error ? emailError.message : emailError
            );
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const lookupKey = lookupKeyFromSubscription(subscription);
        const billingInterval = lookupKey
          ? INTERVAL_BY_LOOKUP_KEY[lookupKey]
          : undefined;

        const update: Record<string, unknown> = {
          status: subscription.status,
          updated_at: new Date().toISOString(),
        };
        // Switching monthly ↔ annual in the Customer Portal lands here.
        if (billingInterval) {
          update.tier = "standard";
          update.billing_interval = billingInterval;
        }

        const { error } = await supabase
          .from("subscriptions")
          .update(update)
          .eq("stripe_subscription_id", subscription.id);
        if (error) {
          throw new Error(`Failed to update subscription: ${error.message}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        if (error) {
          throw new Error(`Failed to cancel subscription: ${error.message}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (!subscriptionId) break;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
        if (error) {
          throw new Error(`Failed to mark past_due: ${error.message}`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (!subscriptionId) break;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
        if (error) {
          throw new Error(`Failed to mark active: ${error.message}`);
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler error";
    console.error(`Stripe webhook error (${event.type}):`, message);
    // 500 tells Stripe to retry — appropriate for transient DB/Stripe failures.
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
