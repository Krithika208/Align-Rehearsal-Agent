"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";
import FoundingPerkCard from "@/components/FoundingPerkCard";
import { FREE_SESSION_LIMIT, type FoundingPerk } from "@/lib/plans";
import {
  RELATIONSHIPS,
  SCENARIOS,
  type Relationship,
  type Scenario,
  type Voice,
} from "./scenarios";

type Step = "pick" | "setup" | "calling" | "complete";

type TranscriptTurn = {
  id: number;
  role: "user" | "agent";
  text: string;
};

// App-signalled session timing. The agent can't time itself, so the app sends
// these cues. The strings must match the ElevenLabs system prompt exactly.
const NUDGE_AT_MS = 15 * 60 * 1000;
const WRAP_AT_MS = 18 * 60 * 1000;
const HARD_STOP_AT_MS = 20 * 60 * 1000;
const NUDGE_CUE = "[Time cue: 15 minutes elapsed]";
const WRAP_CUE = "[Time cue: 18 minutes elapsed - wrap and debrief now]";

type ActiveCall = {
  conversation: Awaited<ReturnType<typeof Conversation.startSession>>;
  dbId: string;
};

export default function AppClient({
  freeSessionsUsed: initialFreeSessionsUsed,
  foundingPerk,
  initialVoice,
  userEmail,
  userName,
  logoutAction,
}: {
  freeSessionsUsed: number | null;
  foundingPerk: FoundingPerk | null;
  initialVoice: Voice;
  userEmail: string;
  userName: string | null;
  logoutAction: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [situation, setSituation] = useState("");
  const [voice, setVoice] = useState<Voice>(initialVoice);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<"listening" | "speaking">("listening");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [wrappingUp, setWrappingUp] = useState(false);
  const [teachingDisabled, setTeachingDisabled] = useState(false);
  const [lastConversationId, setLastConversationId] = useState<string | null>(null);
  const [freeSessionsUsed, setFreeSessionsUsed] = useState(initialFreeSessionsUsed);
  const [fairUseMessage, setFairUseMessage] = useState<string | null>(null);

  const activeCallRef = useRef<ActiveCall | null>(null);
  const turnIdRef = useRef(0);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const wrappingUpRef = useRef(false);
  const stopTimerRef = useRef<(() => void) | null>(null);

  const appendTurn = useCallback((role: "user" | "agent", text: string) => {
    const trimmed = text?.trim();
    if (!trimmed) return;
    turnIdRef.current += 1;
    const turn = { id: turnIdRef.current, role, text: trimmed };
    transcriptRef.current = [...transcriptRef.current, turn];
    setTranscript(transcriptRef.current);
  }, []);

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
    setTranscript([]);
    transcriptRef.current = [];
    setWrappingUp(false);
    wrappingUpRef.current = false;
    turnIdRef.current = 0;
    try {
      const res = await fetch("/api/elevenlabs/start-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_slug: scenario.slug,
          scenario_title: scenario.title,
          relationship,
          situation: situation.trim(),
          voice,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === "free_limit_reached") {
          window.location.href = "/pricing?reason=free_limit_reached";
          return;
        }
        if (body.code === "payment_issue") {
          window.location.href = "/account?reason=payment_issue";
          return;
        }
        if (body.code === "fair_use_cap") {
          setFairUseMessage(body.error);
          return;
        }
        throw new Error(body.error || `Failed to start (${res.status})`);
      }
      const { conversation_db_id, signed_url, free_sessions_used } =
        (await res.json()) as {
          conversation_db_id: string;
          signed_url: string;
          free_sessions_used: number | null;
        };
      if (free_sessions_used !== null) setFreeSessionsUsed(free_sessions_used);

      const conversation = await Conversation.startSession({
        signedUrl: signed_url,
        dynamicVariables: {
          scenario: scenario.label,
          relationship,
          situation: situation.trim(),
        },
        onModeChange: ({ mode }) => {
          setMode(mode === "speaking" ? "speaking" : "listening");
        },
        onMessage: ({ message, source }) => {
          if (!message) return;
          if (source === "user") {
            appendTurn("user", message);
          } else if (source === "ai") {
            appendTurn("agent", message);
          }
        },
        onDisconnect: () => {
          void finalizeCall();
        },
        onError: (msg) => {
          setError(msg);
        },
      });

      activeCallRef.current = { conversation, dbId: conversation_db_id };
      startSessionTimer();
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
    stopTimerRef.current?.();
    stopTimerRef.current = null;
    const elId = active.conversation.getId?.() ?? null;
    const transcriptPayload = transcriptRef.current.map((t) => ({
      source: t.role === "agent" ? "ai" : "user",
      message: t.text,
    }));
    try {
      await fetch("/api/elevenlabs/end-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_db_id: active.dbId,
          el_conversation_id: elId,
          transcript: transcriptPayload,
        }),
      });
    } catch {
      /* best-effort */
    }
    setLastConversationId(active.dbId);
    setStep("complete");
  }, []);

  // Runs from the moment the session connects. Elapsed time comes from
  // performance.now() deltas, so a throttled or backgrounded tab catches up on
  // the next tick (or on refocus) rather than drifting. Cancelled by
  // finalizeCall when the call ends for any reason.
  const startSessionTimer = () => {
    stopTimerRef.current?.();
    const startedAt = performance.now();
    let nudgeSent = false;
    let wrapSent = false;

    const tick = () => {
      const active = activeCallRef.current;
      if (!active) return;
      const elapsed = performance.now() - startedAt;

      if (elapsed >= HARD_STOP_AT_MS) {
        // Deterministic hard stop: hang up and go to the complete screen even
        // if endSession hangs. finalizeCall only runs once.
        active.conversation.endSession().catch(() => {});
        void finalizeCall();
        return;
      }
      if (!wrapSent && elapsed >= WRAP_AT_MS) {
        wrapSent = true;
        nudgeSent = true;
        // Skipped if the user already pressed "Wrap up & debrief".
        if (!wrappingUpRef.current) {
          try {
            active.conversation.sendUserMessage(WRAP_CUE);
            wrappingUpRef.current = true;
            setWrappingUp(true);
          } catch {
            /* best-effort: the 20:00 hard stop still applies */
          }
        }
        return;
      }
      if (!nudgeSent && elapsed >= NUDGE_AT_MS) {
        nudgeSent = true;
        try {
          active.conversation.sendContextualUpdate(NUDGE_CUE);
        } catch {
          /* best-effort */
        }
      }
    };

    const interval = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    stopTimerRef.current = () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  };

  const requestTeachingMode = () => {
    const active = activeCallRef.current;
    if (!active || teachingDisabled) return;
    const signal = "[The user has requested teaching mode]";
    try {
      active.conversation.sendUserMessage(signal);
      setTeachingDisabled(true);
      setTimeout(() => setTeachingDisabled(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send signal");
    }
  };

  const wrapUpRehearsal = () => {
    const active = activeCallRef.current;
    if (!active) return;
    const message = "I'd like to wrap up and move to the debrief now.";
    try {
      active.conversation.sendUserMessage(message);
      appendTurn("user", message);
      wrappingUpRef.current = true;
      setWrappingUp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send wrap-up");
    }
  };

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
      stopTimerRef.current?.();
      const active = activeCallRef.current;
      if (active) {
        active.conversation.endSession().catch(() => {});
      }
    };
  }, []);

  const greeting = userName || userEmail.split("@")[0];

  if (step === "calling") {
    return (
      <CallScreen
        mode={mode}
        transcript={transcript}
        wrappingUp={wrappingUp}
        teachingDisabled={teachingDisabled}
        onTeachingMode={requestTeachingMode}
        onWrapUp={wrapUpRehearsal}
        onEnd={endRehearsal}
      />
    );
  }

  if (step === "complete") {
    return (
      <CompleteScreen
        foundingPerk={foundingPerk}
        conversationId={lastConversationId}
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
        voice={voice}
        setVoice={setVoice}
        freeSessionsUsed={freeSessionsUsed}
        fairUseMessage={fairUseMessage}
        onDismissFairUse={() => setFairUseMessage(null)}
      />
    );
  }

  return (
    <PickerScreen
      freeSessionsUsed={freeSessionsUsed}
      greeting={greeting}
      onPick={pickScenario}
      logoutAction={logoutAction}
    />
  );
}

function FreeSessionsIndicator({ used }: { used: number | null }) {
  if (used === null) return null;
  return (
    <p className="free-indicator">
      {Math.min(used, FREE_SESSION_LIMIT)} of {FREE_SESSION_LIMIT} free
      rehearsals used ·{" "}
      <a href="/pricing" className="free-indicator-link">
        See plans
      </a>
    </p>
  );
}

function FairUseModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <p className="modal-text">{message}</p>
        <button type="button" className="btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

function PickerScreen({
  freeSessionsUsed,
  greeting,
  onPick,
  logoutAction,
}: {
  freeSessionsUsed: number | null;
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
          <a href="/rehearsals" className="app-nav-link">
            My rehearsals
          </a>
          <a href="/account" className="app-nav-link">
            Account
          </a>
          <a href="https://livealign.co" className="app-nav-link">
            About
          </a>
          <form action={logoutAction}>
            <button type="submit" className="app-logout">
              Log out
            </button>
          </form>
        </div>
      </header>
      <div className="app-inner">
        <FreeSessionsIndicator used={freeSessionsUsed} />
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
  voice,
  setVoice,
  freeSessionsUsed,
  fairUseMessage,
  onDismissFairUse,
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
  voice: Voice;
  setVoice: (v: Voice) => void;
  freeSessionsUsed: number | null;
  fairUseMessage: string | null;
  onDismissFairUse: () => void;
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
        <FreeSessionsIndicator used={freeSessionsUsed} />
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

        <div className="voice-choice" role="radiogroup" aria-label="Jordan's voice">
          <span className="voice-choice-label">Jordan&apos;s voice:</span>
          {(["female", "male"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={voice === v}
              className={`voice-choice-btn ${voice === v ? "voice-choice-active" : ""}`}
              onClick={() => setVoice(v)}
            >
              {v === "female" ? "Female" : "Male"}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary auth-submit"
          onClick={onStart}
          disabled={!canStart}
        >
          {starting ? "Connecting…" : "Start rehearsal"}
        </button>
      </div>
      {fairUseMessage && (
        <FairUseModal message={fairUseMessage} onClose={onDismissFairUse} />
      )}
    </main>
  );
}

function CallScreen({
  mode,
  transcript,
  wrappingUp,
  teachingDisabled,
  onTeachingMode,
  onWrapUp,
  onEnd,
}: {
  mode: "listening" | "speaking";
  transcript: TranscriptTurn[];
  wrappingUp: boolean;
  teachingDisabled: boolean;
  onTeachingMode: () => void;
  onWrapUp: () => void;
  onEnd: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  const visualState =
    mode === "speaking" ? "agent" : "listening";

  return (
    <main className="app-shell call-shell">
      <div className="call-card">
        <div
          className={`call-visual call-visual-${visualState}`}
          aria-hidden
        >
          <span className="call-visual-bar" />
          <span className="call-visual-bar" />
          <span className="call-visual-bar" />
          <span className="call-visual-bar" />
          <span className="call-visual-bar" />
        </div>
        <div className="call-name">Jordan</div>
        <div className="call-status">
          {mode === "speaking" ? "Jordan speaking…" : "Listening…"}
        </div>
        <button
          type="button"
          className="btn-teaching-mode"
          onClick={onTeachingMode}
          disabled={teachingDisabled}
        >
          <svg
            className="btn-teaching-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7c.8.7 1.2 1.4 1.2 2.3v1h5.6v-1c0-.9.4-1.6 1.2-2.3A7 7 0 0 0 12 2z" />
          </svg>
          I&apos;m stuck
        </button>
        <button
          type="button"
          className="btn-wrap-up"
          onClick={onWrapUp}
          disabled={wrappingUp}
        >
          {wrappingUp ? "Wrapping up…" : "Wrap up & debrief"}
        </button>
        <button
          type="button"
          className="btn-end-now"
          onClick={onEnd}
        >
          End call now
        </button>
      </div>

      <div className="transcript-panel" aria-live="polite">
        <div className="transcript-label">Live transcript</div>
        <div className="transcript-scroll" ref={scrollRef}>
          {transcript.length === 0 ? (
            <div className="transcript-empty">
              Your conversation will appear here as you and Jordan speak.
            </div>
          ) : (
            transcript.map((turn) => (
              <div
                key={turn.id}
                className={`transcript-turn transcript-turn-${turn.role}`}
              >
                <div className="transcript-speaker">
                  {turn.role === "agent" ? "Jordan" : "You"}
                </div>
                <div className="transcript-text">{turn.text}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function CompleteScreen({
  foundingPerk,
  conversationId,
  onAnother,
  onDone,
}: {
  foundingPerk: FoundingPerk | null;
  conversationId: string | null;
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
        {foundingPerk && !foundingPerk.claimed && (
          <FoundingPerkCard perk={foundingPerk} variant="debrief" />
        )}
        <div className="complete-actions">
          <button type="button" className="btn-primary" onClick={onAnother}>
            Practice another
          </button>
          {conversationId && (
            <a
              className="btn-secondary"
              href={`/rehearsals/${conversationId}`}
            >
              View this rehearsal
            </a>
          )}
          <button type="button" className="btn-secondary" onClick={onDone}>
            Done for now
          </button>
        </div>
      </div>
    </main>
  );
}
