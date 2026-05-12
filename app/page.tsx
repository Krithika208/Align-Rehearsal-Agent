import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? "/app" : "/signup";

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
        <Link href="/login" className="nav-link">
          Sign in
        </Link>
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
              Pick from six common high-stakes conversations — or describe
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

      {/* SCENARIOS */}
      <section className="scenarios-section" id="scenarios">
        <div className="scenarios-inner">
          <div className="section-label">What you can practise</div>
          <h2>Six scenarios, or one of your own</h2>
          <div className="scenario-grid">
            <div className="scenario-card">
              <div className="scenario-icon">💬</div>
              <div>
                <h4>Deliver tough feedback</h4>
                <p>
                  With someone who is likely to push back — a peer, direct
                  report, manager, or co-founder
                </p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">💰</div>
              <div>
                <h4>Negotiate</h4>
                <p>
                  When you&apos;re looking for more than they seem willing to
                  give
                </p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">🛡️</div>
              <div>
                <h4>Push back on a difficult stakeholder</h4>
                <p>Holding your line when they hold the power</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">👋</div>
              <div>
                <h4>End a working relationship</h4>
                <p>Letting someone go or parting ways</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">📢</div>
              <div>
                <h4>Deliver bad news</h4>
                <p>Saying what they may not want to hear</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">🚪</div>
              <div>
                <h4>Resign with grace</h4>
                <p>When they&apos;re not ready to let you go</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">✏️</div>
              <div>
                <h4>Custom</h4>
                <p>Whatever&apos;s keeping you up at night</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <p>
          Built by Krithika at{" "}
          <a
            href="https://livealign.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            livealign.co
          </a>
        </p>
      </footer>
    </>
  );
}
