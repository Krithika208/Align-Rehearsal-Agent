// Coaching notes: short written notes Jordan sends during the call through the
// show_note client tool (configured on both ElevenLabs agents). Shown live on
// the call screen, then on the complete screen and each saved rehearsal page.
// Saved inside the encrypted rehearsal content, never in their own column.

export const NOTE_TOOL = "show_note";
export const MAX_NOTE_CHARS = 400;
const MAX_NOTES = 100;
const MAX_SECONDS = 30 * 60; // calls are cut at 20 minutes

export type CoachingNote = {
  // Seconds since the call connected, taken when the note arrived.
  seconds: number;
  text: string;
};

// The tool's note text, trimmed, or null if it is empty or too long.
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > MAX_NOTE_CHARS) return null;
  return text;
}

// Server side: a list of notes from the browser, checked item by item.
// Anything malformed returns null and no notes are saved.
export function parseNotes(raw: unknown): CoachingNote[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_NOTES) return null;
  const notes: CoachingNote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { seconds, text } = item as Record<string, unknown>;
    const clean = cleanNote(text);
    if (clean === null) return null;
    if (typeof seconds !== "number" || !Number.isInteger(seconds)) return null;
    if (seconds < 0 || seconds > MAX_SECONDS) return null;
    notes.push({ seconds, text: clean });
  }
  return notes;
}

// Saved content: rehearsals saved before coaching notes hold the transcript
// list alone (no notes); newer ones hold { transcript, notes }.
export function readSavedContent(raw: unknown): { transcript: unknown; notes: CoachingNote[] } {
  if (Array.isArray(raw)) return { transcript: raw, notes: [] };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return { transcript: o.transcript, notes: parseNotes(o.notes) ?? [] };
  }
  return { transcript: [], notes: [] };
}

// Markdown-lite: the first line is the heading, lines starting "- " are
// bullets (consecutive ones grouped into one list), anything else is a line.
export type NoteBlock = { kind: "bullets"; items: string[] } | { kind: "line"; text: string };

export function noteParts(text: string): { heading: string; blocks: NoteBlock[] } {
  const [heading = "", ...rest] = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: NoteBlock[] = [];
  for (const line of rest) {
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "bullets") last.items.push(line.slice(2).trim());
      else blocks.push({ kind: "bullets", items: [line.slice(2).trim()] });
    } else {
      blocks.push({ kind: "line", text: line });
    }
  }
  return { heading, blocks };
}

// 125 -> "2:05"
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
