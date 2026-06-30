import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Stripe webhooks need the byte-exact raw body for signature verification.
// Force the Node.js runtime and opt out of static optimization / body parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOUNDING_LOOKUP_KEY = "align_founding_monthly";
const STANDARD_LOOKUP_KEY = "align_standard_monthly";
const FOUNDING_ITERATIONS = 12;

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
  // TEMPORARY DEBUG — remove once the 400 is diagnosed.
  console.error("[stripe-webhook] handler invoked", {
    secretPresent: !!process.env.STRIPE_WEBHOOK_SECRET,
    secretLength: process.env.STRIPE_WEBHOOK_SECRET?.length ?? 0,
    hasSignatureHeader: !!request.headers.get("stripe-signature"),
  });

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
    // TEMPORARY DEBUG — surface the real verification error. Strip after diagnosing.
    console.error("[stripe-webhook] verification or handler error:", {
      message: (error as any)?.message,
      name: (error as any)?.name,
      stack: (error as any)?.stack,
    });
    return NextResponse.json(
      {
        error: "Webhook error",
        debug_message: (error as any)?.message ?? String(error),
        debug_name: (error as any)?.name,
      },
      { status: 400 }
    );
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
          // TEMPORARY DEBUG — surface why schedule creation silently fails.
          try {
            console.error(
              "[stripe-webhook] creating subscription schedule for",
              subscriptionId
            );

            const [foundingPriceId, standardPriceId] = await Promise.all([
              priceIdForLookupKey(FOUNDING_LOOKUP_KEY),
              priceIdForLookupKey(STANDARD_LOOKUP_KEY),
            ]);

            const schedule = await stripe.subscriptionSchedules.create({
              from_subscription: subscriptionId,
            });

            await stripe.subscriptionSchedules.update(schedule.id, {
              end_behavior: "release",
              phases: [
                {
                  items: [{ price: foundingPriceId, quantity: 1 }],
                  // Anchor the schedule to now (fires right after checkout) so
                  // Stripe can compute Phase 1's end date and Phase 2's start.
                  start_date: "now",
                  // 12 monthly billing cycles at the founding rate.
                  duration: { interval: "month", interval_count: FOUNDING_ITERATIONS },
                },
                {
                  items: [{ price: standardPriceId, quantity: 1 }],
                  // No start_date — Stripe anchors it to the end of Phase 1.
                  // No end_date — runs indefinitely at the standard rate.
                },
              ],
            });

            console.error(
              "[stripe-webhook] schedule created successfully:",
              schedule.id
            );

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

            console.error("[stripe-webhook] DB updated with schedule id");
          } catch (scheduleError) {
            console.error("[stripe-webhook] SCHEDULE CREATION FAILED:", {
              message: (scheduleError as any)?.message,
              type: (scheduleError as any)?.type,
              code: (scheduleError as any)?.code,
              stack: (scheduleError as any)?.stack,
            });
            // DO NOT re-throw — we still want the webhook to return 200 so Stripe
            // doesn't retry forever. The row keeps a NULL
            // stripe_subscription_schedule_id (the symptom we're debugging).
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const lookupKey = lookupKeyFromSubscription(subscription);

        const update: Record<string, unknown> = {
          status: subscription.status,
          updated_at: new Date().toISOString(),
        };
        if (lookupKey === STANDARD_LOOKUP_KEY) {
          update.tier = "standard";
        } else if (lookupKey === FOUNDING_LOOKUP_KEY) {
          update.tier = "founding";
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
