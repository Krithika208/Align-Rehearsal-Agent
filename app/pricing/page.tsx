import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import BuyCreditsButton from "@/components/BuyCreditsButton";
import { FREE_SESSION_LIMIT } from "@/lib/plans";

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
        <HeaderMenu
          variant="site"
          loggedIn={!!user}
          links={[
            ...(user ? [{ href: "/account", label: "Account" }] : []),
            user
              ? { href: "/app", label: "Rehearse" }
              : { href: "/login", label: "Sign in" },
            { href: "https://livealign.co", label: "Coaching" },
          ]}
        />
      </nav>

      <main className="pricing-shell">
        {reason === "free_limit_reached" && (
          <div className="pricing-banner" role="status">
            You&apos;ve used your {FREE_SESSION_LIMIT} free rehearsals. Buy more
            below to keep practising. Your saved rehearsals are still in{" "}
            <Link href="/rehearsals">Past rehearsals</Link>.
          </div>
        )}
        <div className="section-label">Pricing</div>
        <h1 className="pricing-heading">
          Start free. Then pay as you go.
        </h1>
        <p className="pricing-sub">
          Rehearse the conversations you&apos;ve been avoiding, with Jordan
          playing the other person.
        </p>

        <div className="pricing-grid">
          <div className="pricing-plan">
            <div className="pricing-card">
              <div className="pricing-badge">Free</div>
              <div className="pricing-amount">
                <span className="pricing-price">$0</span>
              </div>
              <p className="pricing-note">
                {FREE_SESSION_LIMIT} rehearsals. No card required.
              </p>
              <div className="pricing-cta">
                <Link href={user ? "/app" : "/signup"} className="btn-primary">
                  Get started
                </Link>
              </div>

              <ul className="pricing-features">
                <li>{FREE_SESSION_LIMIT} rehearsals with Jordan, up to 20 minutes each</li>
                <li>All five themes, plus your own</li>
                <li>A coaching debrief after every conversation</li>
              </ul>
            </div>
          </div>

          <div className="pricing-plan">
            <div className="pricing-card">
              <div className="pricing-badge">Pay as you go</div>
              <div className="pricing-amount">
                <span className="pricing-price">$3</span>
                <span className="pricing-period">/ rehearsal</span>
              </div>
              <p className="pricing-alt">
                or <strong>$12</strong> for 5 rehearsals
              </p>
              <p className="pricing-note">Credits never expire.</p>
              {user ? (
                <div className="pricing-cta-stack">
                  <BuyCreditsButton pack="single" wrapperClassName="pricing-cta" />
                  <BuyCreditsButton pack="pack_5" wrapperClassName="pricing-cta" />
                </div>
              ) : (
                <div className="pricing-cta">
                  <Link href="/signup" className="btn-primary">
                    Sign up free
                  </Link>
                </div>
              )}

              <ul className="pricing-features">
                <li>One credit is one rehearsal, up to 20 minutes</li>
                <li>All five themes, plus your own</li>
                <li>A coaching debrief after every conversation</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="pricing-finecopy">
          Prices in USD. Tax calculated at checkout. Secure payment by Stripe.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
