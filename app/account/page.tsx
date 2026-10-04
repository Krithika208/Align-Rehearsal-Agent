import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFoundingPerk, getSubscriptionInfo } from "@/lib/subscription";
import { stripe } from "@/lib/stripe";
import SiteFooter from "@/components/SiteFooter";
import ManageBillingButton from "@/components/ManageBillingButton";
import SignOutButton from "@/components/SignOutButton";
import FoundingPerkCard from "@/components/FoundingPerkCard";

export const metadata = {
  title: "Account — Align",
};

const PLAN_BY_INTERVAL: Record<string, { label: string; price: string }> = {
  monthly: { label: "Monthly", price: "$10/month" },
  annual: { label: "Annual", price: "$100/year" },
};

// Friendly labels for Stripe statuses. Never show a raw Stripe value.
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Free trial",
  past_due: "Payment overdue",
  canceled: "Cancelled",
  incomplete: "Payment incomplete",
  incomplete_expired: "Expired",
  unpaid: "Unpaid",
  paused: "Paused",
};

function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type BillingDates = {
  // Unix seconds. periodEnd is the next billing date, or the last day of
  // access when cancelAt is set.
  periodEnd: number | null;
  // Set when the user has cancelled in the portal but the plan hasn't ended.
  cancelAt: number | null;
};

// Read billing dates live from Stripe. In the 2026-05-27.dahlia API version
// current_period_end lives on the subscription item, not the top-level object.
// A portal cancellation sets cancel_at_period_end (or cancel_at); reversing it
// clears both, so the page goes back to the normal view on its own.
async function fetchBillingDates(subscriptionId: string): Promise<BillingDates> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
    const legacy = (subscription as unknown as { current_period_end?: number })
      .current_period_end;
    const periodEnd =
      typeof itemPeriodEnd === "number"
        ? itemPeriodEnd
        : typeof legacy === "number"
          ? legacy
          : null;
    const cancelAt = subscription.cancel_at_period_end
      ? periodEnd
      : subscription.cancel_at ?? null;
    return { periodEnd, cancelAt };
  } catch {
    return { periodEnd: null, cancelAt: null };
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

  const [{ subscription, status, billingInterval }, foundingPerk] =
    await Promise.all([getSubscriptionInfo(), getFoundingPerk()]);
  const plan = billingInterval ? PLAN_BY_INTERVAL[billingInterval] : null;

  let billing: BillingDates = { periodEnd: null, cancelAt: null };
  if (subscription) {
    billing = await fetchBillingDates(subscription.stripe_subscription_id);
  }
  const cancelling = status !== "canceled" && billing.cancelAt !== null;
  const ended = status === "canceled" || status === "incomplete_expired";

  return (
    <>
      <nav>
        <Link href="/" className="logo" aria-label="Align home">
          <img
            src="/brand/align-lockup-navy.svg"
            alt="Align"
            width={115}
            height={32}
          />
        </Link>
        <HeaderMenu
          variant="site"
          loggedIn
          links={[
            { href: "/app", label: "Rehearse" },
            { href: "https://livealign.co", label: "Coaching" },
          ]}
        />
      </nav>

      <main className="account-shell">
        <div className="account-column">
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
              <h1 className="account-heading">Pro</h1>

              <dl className="account-details">
                {plan && (
                  <>
                    <div className="account-row">
                      <dt>Billing</dt>
                      <dd>{plan.label}</dd>
                    </div>
                    <div className="account-row">
                      <dt>Price</dt>
                      <dd>{plan.price}</dd>
                    </div>
                  </>
                )}
                <div className="account-row">
                  <dt>Status</dt>
                  <dd>
                    {cancelling
                      ? `Cancels on ${formatDate(billing.cancelAt! * 1000)}`
                      : STATUS_LABELS[status] ?? "Inactive"}
                  </dd>
                </div>
                {cancelling ? (
                  <div className="account-row">
                    <dt>Access until</dt>
                    <dd>{formatDate(billing.cancelAt! * 1000)}</dd>
                  </div>
                ) : (
                  status !== "canceled" &&
                  billing.periodEnd && (
                    <div className="account-row">
                      <dt>Next billing date</dt>
                      <dd>{formatDate(billing.periodEnd * 1000)}</dd>
                    </div>
                  )
                )}
              </dl>

              {foundingPerk && (
                <FoundingPerkCard perk={foundingPerk} variant="account" />
              )}

              {ended && (
                <div className="account-action">
                  <Link href="/pricing" className="btn-primary">
                    Subscribe again
                  </Link>
                </div>
              )}

              <ManageBillingButton />
            </>
          ) : (
            <>
              <div className="section-label">Account</div>
              <h1 className="account-heading">Free plan</h1>
              <p className="account-note">
                You get 5 free rehearsals. Subscribe for unlimited practice.
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

          <SignOutButton />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
