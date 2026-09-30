"use client";

import { useState } from "react";

type HowItWent = "better" | "same" | "worse";

// Two quick taps on the Rehearsal complete screen: did the real conversation
// happen yet, and if so how did it go. Answers are saved as they're given.
export default function OutcomeCard({ rehearsalId }: { rehearsalId: string }) {
  const [stage, setStage] = useState<"ask" | "how" | "done-yes" | "done-not-yet">("ask");

  const save = (had_conversation: boolean, how_it_went?: HowItWent) => {
    fetch(`/api/rehearsals/${rehearsalId}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ had_conversation, how_it_went }),
      keepalive: true,
    }).catch(() => {});
  };

  if (stage === "done-yes") {
    return (
      <div className="outcome-card">
        <p className="outcome-q">Thanks for sharing.</p>
      </div>
    );
  }
  if (stage === "done-not-yet") {
    return (
      <div className="outcome-card">
        <p className="outcome-q">Good luck. Come back and rehearse again any time.</p>
      </div>
    );
  }

  return (
    <div className="outcome-card">
      {stage === "ask" ? (
        <>
          <p className="outcome-q">Did you have the real conversation yet?</p>
          <div className="outcome-options">
            <button type="button" className="chip" onClick={() => { save(true); setStage("how"); }}>
              Yes
            </button>
            <button type="button" className="chip" onClick={() => { save(false); setStage("done-not-yet"); }}>
              Not yet
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="outcome-q">How did it go?</p>
          <div className="outcome-options">
            {(["better", "same", "worse"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="chip"
                onClick={() => { save(true, v); setStage("done-yes"); }}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
