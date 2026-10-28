"use client";

import { useEffect, useRef, useState } from "react";
import { coachingNotes, formatClock, type CoachingNote, type NoteTurn } from "@/lib/coachingNotes";

const EMPTY_TEXT =
  "Jordan's tips will appear here. Say 'I'm stuck' or press the button any time.";

function NoteList({ notes }: { notes: CoachingNote[] }) {
  return (
    <>
      {notes.map((note, i) => (
        <div key={i} className={`coach-note coach-note-${note.kind}`}>
          {(note.label || note.seconds !== null) && (
            <div className="coach-note-meta">
              {note.label && <span className="coach-note-label">{note.label}</span>}
              {note.seconds !== null && (
                <span className="coach-note-time">{formatClock(note.seconds)}</span>
              )}
            </div>
          )}
          <div className="coach-note-text">{note.text}</div>
        </div>
      ))}
    </>
  );
}

// Call screen: a right-hand panel on laptops, a strip above the transcript on
// phones (CSS picks one at 800px).
export function LiveCoachingNotes({ turns }: { turns: NoteTurn[] }) {
  const notes = coachingNotes(turns);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const el of [scrollRef.current, stripRef.current]) {
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [notes.length, expanded]);

  // The latest tip (or the debrief so far): every line since its label.
  const latestStart = notes.map((n) => n.label !== null).lastIndexOf(true);
  const latest = notes.slice(Math.max(0, latestStart));

  return (
    <>
      <aside className="transcript-panel coach-panel" aria-label="Coaching notes">
        <div className="transcript-label">Coaching notes</div>
        <div className="transcript-scroll coach-scroll" ref={scrollRef}>
          {notes.length === 0 ? (
            <div className="transcript-empty">{EMPTY_TEXT}</div>
          ) : (
            <NoteList notes={notes} />
          )}
        </div>
      </aside>

      <section className="coach-strip" aria-label="Coaching notes">
        {notes.length === 0 ? (
          <>
            <div className="transcript-label coach-strip-label">Coaching notes</div>
            <div className="coach-strip-empty">{EMPTY_TEXT}</div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="coach-strip-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
            >
              <span className="transcript-label coach-strip-label">
                Coaching notes
              </span>
              <span className="coach-strip-action">{expanded ? "Show less" : "Show all"}</span>
            </button>
            {expanded ? (
              <div className="coach-strip-list" ref={stripRef}>
                <NoteList notes={notes} />
              </div>
            ) : (
              <button
                type="button"
                className="coach-strip-latest"
                onClick={() => setExpanded(true)}
              >
                <span className="coach-note-meta">
                  {latest[0].label && <span className="coach-note-label">{latest[0].label}</span>}
                  {latest[0].seconds !== null && (
                    <span className="coach-note-time">{formatClock(latest[0].seconds)}</span>
                  )}
                </span>
                <span className="coach-strip-text">{latest.map((n) => n.text).join(" ")}</span>
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}

// Complete screen and saved rehearsal page. Nothing shows without any notes.
export function CoachingNotesSection({ turns }: { turns: NoteTurn[] }) {
  const notes = coachingNotes(turns);
  if (notes.length === 0) return null;
  return (
    <section className="transcript-panel coach-section" aria-label="Coaching notes">
      <div className="transcript-label">Coaching notes</div>
      <div className="coach-section-list">
        <NoteList notes={notes} />
      </div>
    </section>
  );
}
