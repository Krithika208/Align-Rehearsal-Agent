// How a rehearsal unfolds and ends, as numbers and fixed labels only.
// No words from the conversation are ever kept here: the browser looks at
// Jordan's lines during the call, keeps only a time or a count, and sends
// these fields with the end-of-rehearsal save.

// Jordan's exact phrases (from his ElevenLabs prompt). Detection depends on
// them: if his prompt wording changes, change these too.
export const JORDAN_PHRASES = {
  // Breaking character to start the debrief.
  debrief: "stepping out of character",
  // Teaching mode ("I'm stuck"). Not the debrief.
  teaching: "stepping out for a moment",
} as const;

// A user turn with these words, just before the debrief, counts as asking for it.
const USER_ASKED_FOR_DEBRIEF = /wrap(?:\s|-)?up|debrief/i;

export const DEBRIEF_TRIGGERS = ["button", "time_cue", "user_asked", "jordan", "none"] as const;
export const END_REASONS = ["jordan", "end_call_now", "time_limit", "connection_lost", "unknown"] as const;
export const DEVICE_CLASSES = ["mobile", "desktop"] as const;

export type DebriefTrigger = (typeof DEBRIEF_TRIGGERS)[number];
export type EndReason = (typeof END_REASONS)[number];
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

export type RehearsalSignals = {
  debrief_trigger: DebriefTrigger;
  debrief_started_seconds: number | null;
  ended_by: EndReason;
  user_turns_before_debrief: number;
  jordan_turns_before_debrief: number;
  stuck_count: number;
  device_class: DeviceClass;
  audio_prompt_shown: boolean;
};

const KEYS: (keyof RehearsalSignals)[] = [
  "debrief_trigger",
  "debrief_started_seconds",
  "ended_by",
  "user_turns_before_debrief",
  "jordan_turns_before_debrief",
  "stuck_count",
  "device_class",
  "audio_prompt_shown",
];

// Lower case, straight apostrophes, single spaces.
function normalise(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
}

function deviceClass(): DeviceClass {
  const ua = navigator.userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || iPadAsMac ? "mobile" : "desktop";
}

// One per call, in the browser. Only times, counts and labels are stored.
export function createSignalTracker() {
  let startedAt = performance.now();
  let debriefAt: number | null = null;
  let wrapRequest: "button" | "time_cue" | null = null;
  let lastUserTurnAskedForDebrief = false;
  let trigger: DebriefTrigger = "none";
  let userTurns = 0;
  let jordanTurns = 0;
  let stuck = 0;
  let stuckPending = false;
  let endedBy: EndReason | null = null;
  let audioPrompt = false;

  return {
    // The call connected: debrief times count from here.
    connected() {
      startedAt = performance.now();
    },
    // Something the user said (spoken turns only, not the button's message).
    userTurn(text: string) {
      if (debriefAt !== null) return;
      userTurns++;
      lastUserTurnAskedForDebrief = USER_ASKED_FOR_DEBRIEF.test(text);
    },
    // Something Jordan said.
    jordanTurn(text: string) {
      const t = normalise(text);
      if (t.includes(JORDAN_PHRASES.teaching)) {
        // The "I'm stuck" button already counted this one.
        if (stuckPending) stuckPending = false;
        else stuck++;
      }
      if (debriefAt !== null) return;
      if (t.includes(JORDAN_PHRASES.debrief)) {
        debriefAt = performance.now();
        trigger = wrapRequest ?? (lastUserTurnAskedForDebrief ? "user_asked" : "jordan");
        return;
      }
      jordanTurns++;
    },
    wrapButton() {
      if (!wrapRequest) wrapRequest = "button";
    },
    timeCue() {
      if (!wrapRequest) wrapRequest = "time_cue";
    },
    stuckButton() {
      stuck++;
      stuckPending = true;
    },
    audioPromptShown() {
      audioPrompt = true;
    },
    // The first reason recorded wins.
    ended(reason: EndReason) {
      if (!endedBy) endedBy = reason;
    },
    snapshot(): RehearsalSignals {
      return {
        debrief_trigger: trigger,
        debrief_started_seconds:
          debriefAt === null ? null : Math.round((debriefAt - startedAt) / 1000),
        ended_by: endedBy ?? "unknown",
        user_turns_before_debrief: userTurns,
        jordan_turns_before_debrief: jordanTurns,
        stuck_count: stuck,
        device_class: deviceClass(),
        audio_prompt_shown: audioPrompt,
      };
    },
  };
}

export type SignalTracker = ReturnType<typeof createSignalTracker>;

// Server side: accept exactly these fields, with allowed labels and sensible
// numbers. Anything else returns null and nothing is stored.
const MAX_SECONDS = 30 * 60; // calls are cut at 20 minutes
const MAX_COUNT = 1000;

function isCount(v: unknown, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
}

export function parseSignals(raw: unknown): RehearsalSignals | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== KEYS.length || !keys.every((k) => (KEYS as string[]).includes(k))) {
    return null;
  }
  if (!(DEBRIEF_TRIGGERS as readonly unknown[]).includes(o.debrief_trigger)) return null;
  if (!(END_REASONS as readonly unknown[]).includes(o.ended_by)) return null;
  if (!(DEVICE_CLASSES as readonly unknown[]).includes(o.device_class)) return null;
  if (typeof o.audio_prompt_shown !== "boolean") return null;
  if (!isCount(o.user_turns_before_debrief, MAX_COUNT)) return null;
  if (!isCount(o.jordan_turns_before_debrief, MAX_COUNT)) return null;
  if (!isCount(o.stuck_count, MAX_COUNT)) return null;
  // A debrief has a start time; no debrief has none.
  if (o.debrief_trigger === "none") {
    if (o.debrief_started_seconds !== null) return null;
  } else if (!isCount(o.debrief_started_seconds, MAX_SECONDS)) {
    return null;
  }
  return o as RehearsalSignals;
}
