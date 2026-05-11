"use client";

import Link from "next/link";
import ElevenLabsWidget, { startRehearsal } from "@/components/ElevenLabsWidget";

export default function Home() {
  return (
    <>
      <nav>
        <Link href="/" className="logo" aria-label="Align — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/align-wordmark-navy.svg"
            alt="Align"
            width={76}
            height={32}
            className="nav-logo"
          />
        </Link>
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
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => startRehearsal(e)}
          >
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
          </button>
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
              Pick from eight common high-stakes conversations — or describe
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
          <h2>Eight scenarios, infinite variations</h2>
          <div className="scenario-grid">
            <div className="scenario-card">
              <div className="scenario-icon">💰</div>
              <div>
                <h4>Negotiate a raise or promotion</h4>
                <p>Your manager values you but has budget constraints</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">🛡️</div>
              <div>
                <h4>Push back on a senior stakeholder</h4>
                <p>A VP who wants to change direction on your project</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">💬</div>
              <div>
                <h4>Deliver difficult feedback</h4>
                <p>A direct report who gets defensive and emotional</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">🔄</div>
              <div>
                <h4>Navigate a restructure</h4>
                <p>HR or your manager delivering role-change news</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">✋</div>
              <div>
                <h4>Set boundaries with a peer</h4>
                <p>A colleague who keeps overstepping or taking credit</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">🚪</div>
              <div>
                <h4>Resign gracefully</h4>
                <p>Your manager who tries to counter-offer and guilt-trip</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">↔️</div>
              <div>
                <h4>Ask for a lateral move</h4>
                <p>A manager worried about losing you from the team</p>
              </div>
            </div>
            <div className="scenario-card">
              <div className="scenario-icon">🎯</div>
              <div>
                <h4>Address being passed over</h4>
                <p>The manager who chose someone else</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRY IT */}
      <section className="try-section" id="try">
        <div className="section-label">Try it now</div>
        <h2>
          Click below to begin.
          <br />
          Pick a scenario. Go.
        </h2>
        <p className="try-instructions">
          The widget in the bottom-right corner connects you to Jordan, your
          rehearsal partner. Allow microphone access, choose a scenario, and
          start talking.
        </p>
        <button
          type="button"
          className="widget-callout"
          onClick={(e) => startRehearsal(e)}
        >
          <span>Click to begin</span>
          <span className="arrow">↘</span>
        </button>
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

      {/* Toast for when widget hasn't loaded */}
      <div className="toast" id="toast"></div>

      <ElevenLabsWidget />
    </>
  );
}
