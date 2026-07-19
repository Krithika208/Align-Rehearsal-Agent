import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Stripe webhooks need the byte-exact raw body for signature verification.
// Force the Node.js runtime and opt out of static optimization / body parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOUNDING_LOOKUP_KEY = "align_founding_monthly";
// Founding members transition here after 12 months and stay for life.
const FOUNDING_LOCKED_LOOKUP_KEY = "align_founding_locked_monthly";
const STANDARD_MONTHLY_LOOKUP_KEY = "align_standard_monthly";
const STANDARD_ANNUAL_LOOKUP_KEY = "align_standard_annual";
const FOUNDING_ITERATIONS = 12;

// Founding and founding-locked are both the "founding" tier; the two standard
// prices are the "standard" tier.
function tierForLookupKey(
  lookupKey: string | null
): "founding" | "standard" | null {
  if (
    lookupKey === FOUNDING_LOOKUP_KEY ||
    lookupKey === FOUNDING_LOCKED_LOOKUP_KEY
  ) {
    return "founding";
  }
  if (
    lookupKey === STANDARD_MONTHLY_LOOKUP_KEY ||
    lookupKey === STANDARD_ANNUAL_LOOKUP_KEY
  ) {
    return "standard";
  }
  return null;
}

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
      case "checkout.session.completed": {
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) break;

        const userId = session.metadata?.user_id;
        const isFounding = session.metadata?.founding_member === "true";
        if (!userId) break;

        // Founding is monthly-only → NULL. Standard carries monthly/annual.
        const rawInterval = session.metadata?.billing_interval;
        const billingInterval =
          rawInterval === "monthly" || rawInterval === "annual"
            ? rawInterval
            : null;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        let foundingLockedUntil: Date | null = null;
        if (isFounding) {
          foundingLockedUntil = new Date();
          foundingLockedUntil.setMonth(
            foundingLockedUntil.getMonth() + FOUNDING_ITERATIONS
          );
        }

        const { error: insertError } = await supabase
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId ?? "",
              stripe_subscription_id: subscriptionId,
              tier: isFounding ? "founding" : "standard",
              status: "active",
              billing_interval: billingInterval,
              founding_member: isFounding,
              founding_locked_until: foundingLockedUntil
                ? foundingLockedUntil.toISOString()
                : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (insertError) {
          throw new Error(`Failed to insert subscription: ${insertError.message}`);
        }

        // For founding members, schedule the auto-transition to standard rate
        // after 12 billing cycles. Schedules can only be created from an
        // existing subscription, so this happens here, not at checkout.
        if (isFounding) {
          // Schedule creation is best-effort: if it fails we still return 200
          // (so Stripe doesn't retry the whole webhook) and leave
          // stripe_subscription_schedule_id NULL for later reconciliation.
          try {
            // Phase 1 = $3.99 founding rate for 12 months; Phase 2 = the
            // $11.99 founding-locked rate for life (NOT the standard rate).
            const [foundingPriceId, foundingLockedPriceId] = await Promise.all([
              priceIdForLookupKey(FOUNDING_LOOKUP_KEY),
              priceIdForLookupKey(FOUNDING_LOCKED_LOOKUP_KEY),
            ]);

            const schedule = await stripe.subscriptionSchedules.create({
              from_subscription: subscriptionId,
            });

            // Phase 1 needs a numeric Unix timestamp to anchor end dates —
            // the string 'now' is accepted by the types but rejected at runtime
            // on a from_subscription schedule. Use the subscription's current
            // period start. In the 2026-05-27.dahlia API version that lives on
            // the subscription item, not the top-level subscription; fall back
            // to the schedule's own auto-populated first-phase start.
            const subscription = await stripe.subscriptions.retrieve(
              subscriptionId
            );
            const phase1Start =
              subscription.items.data[0]?.current_period_start ??
              schedule.phases[0]?.start_date;

            await stripe.subscriptionSchedules.update(schedule.id, {
              end_behavior: "release",
              phases: [
                {
                  items: [{ price: foundingPriceId, quantity: 1 }],
                  // Numeric timestamp anchor (not 'now').
                  start_date: phase1Start,
                  // 12 monthly billing cycles at the founding rate.
                  duration: { interval: "month", interval_count: FOUNDING_ITERATIONS },
                },
                {
                  items: [{ price: foundingLockedPriceId, quantity: 1 }],
                  // No start_date — Stripe anchors it to the end of Phase 1.
                  // No end_date — runs indefinitely at the founding-locked rate.
                },
              ],
            });

            const { error: scheduleUpdateError } = await supabase
              .from("subscriptions")
              .update({
                stripe_subscription_schedule_id: schedule.id,
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_subscription_id", subscriptionId);

            if (scheduleUpdateError) {
              throw new Error(
                `Failed to save schedule id: ${scheduleUpdateError.message}`
              );
            }
          } catch (scheduleError) {
            const message =
              scheduleError instanceof Error
                ? scheduleError.message
                : String(scheduleError);
            console.error(
              `[stripe-webhook] subscription schedule creation failed for ${subscriptionId}:`,
              message
            );
            // Deliberately not re-thrown — the webhook still returns 200 so
            // Stripe doesn't retry the whole event.
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const lookupKey = lookupKeyFromSubscription(subscription);
        const tier = tierForLookupKey(lookupKey);

        const update: Record<string, unknown> = {
          status: subscription.status,
          updated_at: new Date().toISOString(),
        };
        if (tier) {
          update.tier = tier;
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
