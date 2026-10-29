"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock, noteParts, type CoachingNote } from "@/lib/coachingNotes";

const EMPTY_TEXT =
  "Jordan's tips will appear here. Say 'I'm stuck' or press the button any time.";

function NoteList({ notes }: { notes: CoachingNote[] }) {
  return (
    <>
      {notes.map((note, i) => {
        const { heading, blocks } = noteParts(note.text);
        return (
          <div key={i} className="coach-note">
            <div className="coach-note-head">
              <span className="coach-note-heading">{heading}</span>
              <span className="coach-note-time">{formatClock(note.seconds)}</span>
            </div>
            {blocks.map((b, j) =>
              b.kind === "bullets" ? (
                <ul key={j} className="coach-note-bullets">
                  {b.items.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={j} className="coach-note-text">
                  {b.text}
                </p>
              )
            )}
          </div>
        );
      })}
    </>
  );
}

// Call screen: a right-hand panel on laptops, a strip above the transcript on
// phones (CSS picks one at 800px).
export function LiveCoachingNotes({ notes }: { notes: CoachingNote[] }) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const el of [scrollRef.current, stripRef.current]) {
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [notes.length, expanded]);

  const latest = notes[notes.length - 1];

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
        {!latest ? (
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
              <span className="transcript-label coach-strip-label">Coaching notes</span>
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
                <span className="coach-note-heading coach-strip-text">
                  {noteParts(latest.text).heading}
                </span>
                <span className="coach-note-time">{formatClock(latest.seconds)}</span>
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}

// Complete screen and saved rehearsal page. Nothing shows without any notes.
export function CoachingNotesSection({ notes }: { notes: CoachingNote[] }) {
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
