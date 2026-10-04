import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import { SCENARIOS } from "./app/scenarios";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? "/app" : "/signup";

  // Hide the Pricing link from anyone who already has an active subscription.
  let hasActiveSubscription = false;
  if (user) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    hasActiveSubscription =
      subscription?.status === "active" || subscription?.status === "trialing";
  }

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
            ...(!hasActiveSubscription ? [{ href: "/pricing", label: "Pricing" }] : []),
            ...(user ? [{ href: "/account", label: "Account" }] : []),
            user
              ? { href: "/app", label: "Your rehearsals" }
              : { href: "/login", label: "Sign in" },
            { href: "https://livealign.co", label: "Coaching" },
          ]}
        />
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="badge">
          <div className="dot"></div>
          Voice AI — try it live
        </div>
        <h1>
          Rehearse the conversation <em>before</em> you have it
        </h1>
        <p className="hero-sub">
          An agent that plays your manager, your stakeholder, your difficult
          colleague — and pushes back the way they would. Practise until
          you&apos;re ready.
        </p>
        <div className="cta-group">
          <Link href={ctaHref} className="btn-primary">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            Start a rehearsal
          </Link>
          <a href="#how" className="btn-secondary">
            How it works
          </a>
        </div>
        <a href="#how" className="scroll-cue">
          Scroll to see how it works
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </a>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="section-label">How it works</div>
        <h2>
          A flight simulator for
          <br />
          workplace conversations
        </h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <h3>Choose a scenario</h3>
            <p>
              Pick from five tough workplace conversations — or describe
              your own specific situation. The agent confirms the setup before
              you begin.
            </p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <h3>Have the conversation</h3>
            <p>
              The agent plays the other person with realistic pushback,
              emotional texture, and workplace dynamics. It escalates difficulty
              as you get sharper.
            </p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <h3>Get your debrief</h3>
            <p>
              After the rehearsal, the agent breaks character and gives you
              specific feedback: what worked, what to adjust, and a suggested
              opening line for the real thing.
            </p>
          </div>
        </div>
      </section>

      {/* I'M STUCK CALLOUT */}
      <section className="stuck-section">
        <div className="stuck-card">
          <h2>Stuck mid-conversation? Just say so.</h2>
          <p>
            When you don&apos;t know what to say next, tell Jordan you&apos;re
            stuck and get real-time coaching without breaking the rehearsal.
            Then pick up where you left off.
          </p>
        </div>
      </section>

      {/* SCENARIOS */}
      <section className="scenarios-section" id="scenarios">
        <div className="scenarios-inner">
          <div className="section-label">What you can practise</div>
          <h2>Five themes, or one of your own</h2>
          <div className="scenario-grid">
            {SCENARIOS.map((s) => (
              <div key={s.slug} className="scenario-card">
                <div className="scenario-icon">{s.icon}</div>
                <div>
                  <h4>{s.title}</h4>
                  <p>{s.subhead}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
