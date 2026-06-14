import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import SubscribeButton from "@/components/SubscribeButton";

export const metadata = {
  title: "Pricing — Align",
};

const FOUNDING_CAP = 100;

export default async function PricingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: foundingCount } = await supabase.rpc("get_founding_count");
  const spotsRemaining = Math.max(FOUNDING_CAP - (foundingCount ?? 0), 0);
  const foundingOpen = spotsRemaining > 0;

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
        <Link href={user ? "/app" : "/login"} className="nav-link">
          {user ? "Your rehearsals" : "Sign in"}
        </Link>
      </nav>

      <main className="pricing-shell">
        <div className="section-label">Pricing</div>
        <h1 className="pricing-heading">
          One plan. <em>Unlimited</em> practice.
        </h1>
        <p className="pricing-sub">
          Rehearse the conversations you&apos;ve been avoiding — as many times
          as you need, with Jordan playing the other person.
        </p>

        <div className="pricing-card">
          {foundingOpen ? (
            <>
              <div className="pricing-badge">Founding rate</div>
              <div className="pricing-amount">
                <span className="pricing-price">$3.99</span>
                <span className="pricing-period">/ month</span>
              </div>
              <p className="pricing-note">
                for 12 months, then $11.99/month
              </p>
              <p className="pricing-spots">
                {spotsRemaining} of {FOUNDING_CAP} founding spots left
              </p>
              <SubscribeButton label="Claim your founding rate" />
            </>
          ) : (
            <>
              <div className="pricing-badge">Standard</div>
              <div className="pricing-amount">
                <span className="pricing-price">$11.99</span>
                <span className="pricing-period">/ month</span>
              </div>
              <p className="pricing-note">Billed monthly. Cancel anytime.</p>
              <SubscribeButton label="Subscribe" />
            </>
          )}

          <ul className="pricing-features">
            <li>Unlimited rehearsals with Jordan</li>
            <li>All six launch scenarios — plus your own</li>
            <li>A coaching debrief after every conversation</li>
          </ul>
        </div>

        <p className="pricing-finecopy">
          Prices in USD. Tax calculated at checkout. Secure payment by Stripe.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
