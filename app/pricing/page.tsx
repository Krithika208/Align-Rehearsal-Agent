import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import PaidPlanCard from "./PaidPlanCard";

export const metadata = {
  title: "Pricing — Align",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <div className="nav-links">
          {user && (
            <Link href="/account" className="nav-link">
              Account
            </Link>
          )}
          <Link href={user ? "/app" : "/login"} className="nav-link">
            {user ? "Your rehearsals" : "Sign in"}
          </Link>
          <a href="https://livealign.co" className="nav-link">
            About
          </a>
        </div>
      </nav>

      <main className="pricing-shell">
        {reason === "free_limit_reached" && (
          <div className="pricing-banner" role="status">
            You&apos;ve used your 5 free rehearsals. Subscribe to keep
            practising. Your past rehearsals are still in{" "}
            <Link href="/rehearsals">My rehearsals</Link>.
          </div>
        )}
        <div className="section-label">Pricing</div>
        <h1 className="pricing-heading">
          Start free. <em>Unlimited</em> practice from $10.
        </h1>
        <p className="pricing-sub">
          Rehearse the conversations you&apos;ve been avoiding, as many times
          as you need, with Jordan playing the other person.
        </p>

        <div className="pricing-grid">
          <div className="pricing-plan">
            <div className="pricing-card">
              <div className="pricing-badge">Free</div>
              <div className="pricing-amount">
                <span className="pricing-price">$0</span>
              </div>
              <p className="pricing-note">5 rehearsals. No card required.</p>
              <div className="pricing-cta">
                <Link href={user ? "/app" : "/signup"} className="btn-primary">
                  Get started
                </Link>
              </div>

              <ul className="pricing-features">
                <li>5 lifetime rehearsals with Jordan</li>
                <li>All six launch scenarios, plus your own</li>
                <li>A coaching debrief after every conversation</li>
              </ul>
            </div>
          </div>

          <PaidPlanCard />
        </div>

        <p className="pricing-finecopy">
          Prices in USD. Tax calculated at checkout. Secure payment by Stripe.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
