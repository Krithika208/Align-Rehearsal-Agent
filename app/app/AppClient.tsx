"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";
import {
  RELATIONSHIPS,
  SCENARIOS,
  type Relationship,
  type Scenario,
} from "./scenarios";

type Step = "pick" | "setup" | "calling" | "complete";

type ActiveCall = {
  conversation: Awaited<ReturnType<typeof Conversation.startSession>>;
  dbId: string;
};

export default function AppClient({
  userEmail,
  userName,
  logoutAction,
}: {
  userEmail: string;
  userName: string | null;
  logoutAction: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [situation, setSituation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<"listening" | "speaking">("listening");

  const activeCallRef = useRef<ActiveCall | null>(null);

  const pickScenario = (s: Scenario) => {
    setScenario(s);
    setStep("setup");
    setError(null);
  };

  const backToPicker = () => {
    setScenario(null);
    setRelationship(null);
    setSituation("");
    setError(null);
    setStep("pick");
  };

  const startRehearsal = async () => {
    if (!scenario || !relationship || !situation.trim()) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/elevenlabs/start-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_slug: scenario.slug,
          scenario_title: scenario.title,
          relationship,
          situation: situation.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to start (${res.status})`);
      }
      const { conversation_db_id, signed_url } = (await res.json()) as {
        conversation_db_id: string;
        signed_url: string;
      };

      const conversation = await Conversation.startSession({
        signedUrl: signed_url,
        dynamicVariables: {
          scenario: scenario.title,
          relationship,
          situation: situation.trim(),
        },
        onModeChange: ({ mode }) => {
          setMode(mode === "speaking" ? "speaking" : "listening");
        },
        onDisconnect: () => {
          void finalizeCall();
        },
        onError: (msg) => {
          setError(msg);
        },
      });

      activeCallRef.current = { conversation, dbId: conversation_db_id };
      setStep("calling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStarting(false);
    }
  };

  const finalizeCall = useCallback(async () => {
    const active = activeCallRef.current;
    if (!active) return;
    activeCallRef.current = null;
    const elId = active.conversation.getId?.() ?? null;
    try {
      await fetch("/api/elevenlabs/end-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_db_id: active.dbId,
          el_conversation_id: elId,
        }),
      });
    } catch {
      /* best-effort */
    }
    setStep("complete");
  }, []);

  const endRehearsal = async () => {
    const active = activeCallRef.current;
    if (!active) {
      setStep("complete");
      return;
    }
    try {
      await active.conversation.endSession();
    } catch {
      // onDisconnect should fire and call finalizeCall, but fall back
      await finalizeCall();
    }
  };

  useEffect(() => {
    return () => {
      const active = activeCallRef.current;
      if (active) {
        active.conversation.endSession().catch(() => {});
      }
    };
  }, []);

  const greeting = userName || userEmail.split("@")[0];

  if (step === "calling") {
    return (
      <CallScreen mode={mode} onEnd={endRehearsal} />
    );
  }

  if (step === "complete") {
    return (
      <CompleteScreen
        onAnother={backToPicker}
        onDone={() => {
          setScenario(null);
          setRelationship(null);
          setSituation("");
          setStep("pick");
        }}
      />
    );
  }

  if (step === "setup" && scenario) {
    return (
      <SetupScreen
        scenario={scenario}
        relationship={relationship}
        setRelationship={setRelationship}
        situation={situation}
        setSituation={setSituation}
        onBack={backToPicker}
        onStart={startRehearsal}
        starting={starting}
        error={error}
      />
    );
  }

  return (
    <PickerScreen
      greeting={greeting}
      onPick={pickScenario}
      logoutAction={logoutAction}
    />
  );
}

function PickerScreen({
  greeting,
  onPick,
  logoutAction,
}: {
  greeting: string;
  onPick: (s: Scenario) => void;
  logoutAction: () => Promise<void>;
}) {
  return (
    <main className="app-shell">
      <header className="app-header">
        <a href="/" className="auth-logo">
          align<span>.</span>
        </a>
        <div className="app-header-right">
          <span className="app-user">Hi, {greeting}</span>
          <form action={logoutAction}>
            <button type="submit" className="app-logout">
              Log out
            </button>
          </form>
        </div>
      </header>
      <div className="app-inner">
        <div className="section-label">Pick a scenario</div>
        <h1 className="app-heading">
          What do you want to rehearse?
        </h1>
        <p className="app-sub">
          Choose the conversation you&apos;ve been avoiding. Jordan will play the
          other person.
        </p>
        <div className="picker-grid">
          {SCENARIOS.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="picker-card"
              onClick={() => onPick(s)}
            >
              <div className="picker-icon">{s.icon}</div>
              <div>
                <h4>{s.title}</h4>
                <p>{s.subhead}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function SetupScreen({
  scenario,
  relationship,
  setRelationship,
  situation,
  setSituation,
  onBack,
  onStart,
  starting,
  error,
}: {
  scenario: Scenario;
  relationship: Relationship | null;
  setRelationship: (r: Relationship) => void;
  situation: string;
  setSituation: (s: string) => void;
  onBack: () => void;
  onStart: () => void;
  starting: boolean;
  error: string | null;
}) {
  const canStart = !!relationship && situation.trim().length > 0 && !starting;
  return (
    <main className="app-shell">
      <header className="app-header">
        <button type="button" className="app-back" onClick={onBack}>
          <span aria-hidden>←</span> Back
        </button>
        <a href="/" className="auth-logo">
          align<span>.</span>
        </a>
      </header>
      <div className="app-inner app-inner-narrow">
        <div className="section-label">Setup</div>
        <h1 className="app-heading">
          <span className="setup-icon" aria-hidden>{scenario.icon}</span>
          {scenario.title}
        </h1>
        <p className="app-sub">{scenario.subhead}</p>

        <div className="setup-block">
          <label className="setup-label">Who are you talking to?</label>
          <div className="chip-row">
            {RELATIONSHIPS.map((r) => (
              <button
                key={r}
                type="button"
                className={`chip ${relationship === r ? "chip-active" : ""}`}
                onClick={() => setRelationship(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-block">
          <label className="setup-label" htmlFor="situation">
            In one or two sentences, what&apos;s the situation?
          </label>
          <textarea
            id="situation"
            className="auth-input setup-textarea"
            rows={3}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g. My manager keeps assigning me work that should go to a peer, and I want to push back without sounding unhelpful."
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="button"
          className="btn-primary auth-submit"
          onClick={onStart}
          disabled={!canStart}
        >
          {starting ? "Connecting…" : "Start rehearsal"}
        </button>
      </div>
    </main>
  );
}

function CallScreen({
  mode,
  onEnd,
}: {
  mode: "listening" | "speaking";
  onEnd: () => void;
}) {
  return (
    <main className="app-shell call-shell">
      <div className="call-card">
        <div className={`mic-indicator ${mode === "speaking" ? "mic-speaking" : ""}`}>
          <svg
            width="32"
            height="32"
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
        </div>
        <div className="call-name">Jordan</div>
        <div className="call-status">
          {mode === "speaking" ? "Speaking…" : "Listening…"}
        </div>
        <button type="button" className="btn-end-call" onClick={onEnd}>
          End rehearsal
        </button>
      </div>
    </main>
  );
}

function CompleteScreen({
  onAnother,
  onDone,
}: {
  onAnother: () => void;
  onDone: () => void;
}) {
  return (
    <main className="app-shell">
      <div className="app-inner app-inner-narrow complete-inner">
        <div className="section-label">Rehearsal complete</div>
        <h1 className="app-heading">Nice work.</h1>
        <p className="app-sub">
          That&apos;s the practice rep done. Want to go again, or save it for
          later?
        </p>
        <div className="complete-actions">
          <button type="button" className="btn-primary" onClick={onAnother}>
            Practice another
          </button>
          <button type="button" className="btn-secondary" onClick={onDone}>
            Done for now
          </button>
        </div>
      </div>
    </main>
  );
}
