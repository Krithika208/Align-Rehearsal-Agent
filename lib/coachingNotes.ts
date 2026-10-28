// Jordan's coaching lines, picked out of a transcript: teaching-mode tips
// ("I'm stuck") and the debrief. Roleplay lines are never included. Used live
// on the call screen and, from the saved transcript, on the complete screen
// and each saved rehearsal page. Detection depends on Jordan's exact phrases
// (JORDAN_PHRASES), the same ones the end-of-rehearsal tracking uses.
import { JORDAN_PHRASES, normalise } from "./rehearsalSignals";

export type NoteTurn = {
  role: "user" | "agent";
  text: string;
  // Seconds into the call. Missing on rehearsals saved before this existed.
  seconds?: number | null;
};

export type CoachingNote = {
  // "Tip 1", "Tip 2"... or "Debrief". Set on the first line of each group only.
  label: string | null;
  kind: "tip" | "debrief";
  text: string;
  seconds: number | null;
};

export function coachingNotes(turns: NoteTurn[]): CoachingNote[] {
  const notes: CoachingNote[] = [];
  let inTip = false;
  let inDebrief = false;
  let tips = 0;
  for (const turn of turns) {
    if (turn.role !== "agent") continue;
    const t = normalise(turn.text);
    let label: string | null = null;
    if (!inDebrief && t.includes(JORDAN_PHRASES.debrief)) {
      inDebrief = true;
      inTip = false;
      label = "Debrief";
    } else if (!inDebrief && t.includes(JORDAN_PHRASES.teaching)) {
      inTip = true;
      tips++;
      label = `Tip ${tips}`;
    }
    if (!inDebrief && !inTip) continue;
    notes.push({
      label,
      kind: inDebrief ? "debrief" : "tip",
      text: turn.text,
      seconds: typeof turn.seconds === "number" ? turn.seconds : null,
    });
    // His "pick up where we left off?" question closes the tip.
    if (inTip && t.includes(JORDAN_PHRASES.teachingEnd)) inTip = false;
  }
  return notes;
}

// 125 -> "2:05"
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
