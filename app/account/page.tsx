import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionInfo } from "@/lib/subscription";
import { stripe } from "@/lib/stripe";
import SiteFooter from "@/components/SiteFooter";
import ManageBillingButton from "@/components/ManageBillingButton";

export const metadata = {
  title: "Account — Align",
};

const PRICE_BY_TIER: Record<string, string> = {
  founding: "$3.99/month",
  standard: "$11.99/month",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  unpaid: "Unpaid",
};

function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Pull the next billing date from Stripe. In the 2026-05-27.dahlia API version
// current_period_end lives on the subscription item, not the top-level object.
async function fetchNextBillingDate(
  subscriptionId: string
): Promise<number | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
    if (typeof itemPeriodEnd === "number") return itemPeriodEnd;
    const legacy = (subscription as unknown as { current_period_end?: number })
      .current_period_end;
    return typeof legacy === "number" ? legacy : null;
  } catch {
    return null;
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/account");

  const { subscription, tier, status } = await getSubscriptionInfo();

  let nextBillingDate: number | null = null;
  if (subscription) {
    nextBillingDate = await fetchNextBillingDate(
      subscription.stripe_subscription_id
    );
  }

  return (
    <>
      <nav>
        <a href="https://livealign.co" className="logo">
          <img
            src="/brand/align-lockup-navy.svg"
            alt="Align"
            width={115}
            height={32}
          />
        </a>
        <div className="nav-links">
          <Link href="/app" className="nav-link">
            Your rehearsals
          </Link>
        </div>
      </nav>

      <main className="account-shell">
        <div className="account-card">
          {reason === "payment_issue" && (
            <div className="account-banner" role="status">
              There&apos;s a problem with your latest payment. Update your billing
              details below to restore access.
            </div>
          )}
          {subscription ? (
            <>
              <div className="section-label">Your subscription</div>
              <h1 className="account-heading">
                {tier === "founding" ? "Founding member" : "Standard"}
              </h1>

              <dl className="account-details">
                <div className="account-row">
                  <dt>Price</dt>
                  <dd>{PRICE_BY_TIER[tier ?? "standard"]}</dd>
                </div>
                <div className="account-row">
                  <dt>Status</dt>
                  <dd>{STATUS_LABELS[status] ?? status}</dd>
                </div>
                {nextBillingDate && (
                  <div className="account-row">
                    <dt>Next billing date</dt>
                    <dd>{formatDate(nextBillingDate * 1000)}</dd>
                  </div>
                )}
              </dl>

              {tier === "founding" && subscription.founding_locked_until && (
                <p className="account-note">
                  Your founding rate is locked until{" "}
                  <strong>{formatDate(subscription.founding_locked_until)}</strong>.
                  After that, your subscription will automatically continue at
                  $11.99/month.
                </p>
              )}

              <ManageBillingButton />
            </>
          ) : (
            <>
              <div className="section-label">Account</div>
              <h1 className="account-heading">No active subscription</h1>
              <p className="account-note">
                You don&apos;t have an active Align subscription yet.
              </p>
              <div className="account-action">
                <Link href="/pricing" className="btn-primary">
                  See pricing
                </Link>
              </div>
            </>
          )}

          <div className="account-meta">
            <span className="account-email">{user.email}</span>
            <nav className="account-footer-nav" aria-label="Legal">
              <Link href="/disclaimer">Disclaimer</Link>
              <span aria-hidden>·</span>
              <Link href="/privacy">Privacy</Link>
              <span aria-hidden>·</span>
              <Link href="/terms">Terms</Link>
            </nav>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
