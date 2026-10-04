// Debug log for rehearsal audio, shown only with ?debug=1 in the address.
// Used to see what a real phone does between the Start tap and Jordan's first
// words. With the flag off, nothing is patched and dlog() does nothing.

import { sourceInfo } from "@elevenlabs/client/internal";

export const DEBUG =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debug") === "1";

const pageStart = typeof performance !== "undefined" ? performance.now() : 0;
let startTap: number | null = null;
let lines: string[] = [];
const listeners = new Set<() => void>();

function stamp(): string {
  const now = performance.now();
  if (startTap === null) return `pre ${((now - pageStart) / 1000).toFixed(2)}s`;
  return `+${((now - startTap) / 1000).toFixed(2)}s`;
}

export function dlog(msg: string): void {
  if (!DEBUG) return;
  lines = [...lines, `${stamp()}  ${msg}`];
  listeners.forEach((l) => l());
}

export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLog(): string[] {
  return lines;
}

function isIosLike(): boolean {
  // Same test the SDK uses to decide whether to unlock iOS audio.
  return (
    ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(
      navigator.platform
    ) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

// Called on the Start tap. Times after this are seconds since the tap.
export function markStartTap(): void {
  if (!DEBUG) return;
  startTap = performance.now();
  dlog("===== Start tapped =====");
  dlog(`build ${process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown"}`);
  dlog(`ElevenLabs SDK ${sourceInfo.version}`);
  dlog(`device: ${navigator.platform}, SDK sees iOS: ${isIosLike()}`);
  dlog(`browser: ${navigator.userAgent}`);
}

// ---- Player state (the SDK keeps these private) ----

type Internals = { context?: unknown; audioElement?: unknown };

function ctxId(ctx: unknown): string {
  const id = (ctx as { __dbgId?: number } | null)?.__dbgId;
  return id ? `#${id}` : "#?";
}

function elState(el: HTMLMediaElement): string {
  return `paused=${el.paused} muted=${el.muted} volume=${el.volume}`;
}

export function logPlayerState(conversation: unknown, when: string): void {
  if (!DEBUG) return;
  const c = conversation as { output?: Internals; input?: Internals } | null;
  const out = c?.output;
  const inp = c?.input;
  const parts: string[] = [];
  if (out?.context instanceof BaseAudioContext) {
    parts.push(`player context ${ctxId(out.context)} ${out.context.state} ${out.context.sampleRate} Hz`);
  } else {
    parts.push("player context: not found");
  }
  if (out?.audioElement instanceof HTMLMediaElement) {
    parts.push(`audio element ${elState(out.audioElement)}`);
  } else {
    parts.push("audio element: not found");
  }
  if (inp?.context instanceof BaseAudioContext) {
    parts.push(`mic context ${ctxId(inp.context)} ${inp.context.state}`);
  }
  dlog(`[state: ${when}] ${parts.join(" | ")}`);
}

// Logs when Jordan's output starts and stops carrying sound, for 20 seconds.
// The level is measured before the hidden audio element, so "sound in player"
// with a paused element means the sound is going nowhere.
export function watchOutputLevel(conversation: { getOutputVolume: () => number }): void {
  if (!DEBUG) return;
  let loud = false;
  const started = performance.now();
  const timer = window.setInterval(() => {
    let v = 0;
    try {
      v = conversation.getOutputVolume();
    } catch {
      window.clearInterval(timer);
      return;
    }
    if (!loud && v > 0.01) {
      loud = true;
      dlog(`player level: sound (${v.toFixed(3)})`);
      logPlayerState(conversation, "sound starts");
    } else if (loud && v <= 0.01) {
      loud = false;
      dlog("player level: silent");
    }
    if (performance.now() - started > 20000) {
      window.clearInterval(timer);
      dlog("player level: stopped watching (20s)");
    }
  }, 150);
}

// ---- Browser patches, debug only ----

function install(): void {
  // Audio contexts: every one the SDK creates, and each state change.
  const Orig = window.AudioContext;
  if (Orig) {
    let n = 0;
    class LoggedAudioContext extends Orig {
      constructor(options?: AudioContextOptions) {
        super(options);
        const id = ++n;
        (this as unknown as { __dbgId: number }).__dbgId = id;
        dlog(
          `audio context #${id} created: ${this.state}, ${this.sampleRate} Hz (asked for ${options?.sampleRate ?? "default"})`
        );
        this.addEventListener("statechange", () =>
          dlog(`audio context #${id} is now ${this.state}`)
        );
      }
    }
    window.AudioContext = LoggedAudioContext;

    const resume = Orig.prototype.resume;
    Orig.prototype.resume = function (this: AudioContext) {
      const id = ctxId(this);
      dlog(`audio context ${id} resume() called (was ${this.state})`);
      return resume.call(this).then(
        () => dlog(`audio context ${id} resume() done: ${this.state}`),
        (err: unknown) => {
          dlog(`audio context ${id} resume() failed: ${String(err)}`);
          throw err;
        }
      );
    };
  }

  // Worklet files: the SDK's player and the resampler.
  if (typeof AudioWorklet !== "undefined") {
    const addModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = function (this: AudioWorklet, url: string | URL, ...rest) {
      const u = String(url);
      const name = u.startsWith("blob:")
        ? "SDK worklet"
        : u.includes("libsamplerate")
          ? "resampler (cdn.jsdelivr.net)"
          : u.slice(0, 60);
      const t = performance.now();
      dlog(`loading ${name}`);
      return addModule.call(this, url, ...rest).then(
        () => dlog(`loaded ${name} in ${Math.round(performance.now() - t)} ms`),
        (err: unknown) => {
          dlog(`FAILED to load ${name}: ${String(err)}`);
          throw err;
        }
      );
    };
  }

  // The hidden audio element Jordan's voice plays through.
  const watched = new WeakSet<HTMLMediaElement>();
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    if (!(this instanceof HTMLAudioElement)) return play.call(this);
    if (!watched.has(this)) {
      watched.add(this);
      this.addEventListener("playing", () => dlog(`audio element playing (${elState(this)})`));
      this.addEventListener("pause", () => dlog(`audio element paused (${elState(this)})`));
      this.addEventListener("volumechange", () => dlog(`audio element volume change (${elState(this)})`));
    }
    dlog(`audio element play() called (${elState(this)})`);
    return play.call(this).then(
      () => dlog(`audio element play() succeeded (${elState(this)})`),
      (err: unknown) => {
        dlog(`audio element play() REJECTED: ${(err as Error)?.name ?? err} (${elState(this)})`);
        throw err;
      }
    );
  };

  // The connection to ElevenLabs: when each message really arrives. The SDK
  // holds early messages until its player is ready, so its own callbacks
  // fire later than this.
  const OrigWS = window.WebSocket;
  class LoggedWebSocket extends OrigWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      if (!String(url).includes("convai")) return;
      dlog("network: connecting to ElevenLabs");
      let audio = 0;
      this.addEventListener("open", () => dlog("network: connected"));
      this.addEventListener("close", (e) =>
        dlog(`network: closed (code ${e.code}${e.reason ? `, ${e.reason.slice(0, 60)}` : ""})`)
      );
      this.addEventListener("message", (e) => {
        let m: Record<string, unknown>;
        try {
          m = JSON.parse(String(e.data));
        } catch {
          return;
        }
        const type = String(m.type);
        if (type === "ping" || type === "vad_score") return;
        if (type === "audio") {
          audio++;
          const ev = m.audio_event as { event_id?: number; audio_base_64?: string } | undefined;
          const kb = Math.round(((ev?.audio_base_64?.length ?? 0) * 0.75) / 1024);
          dlog(`network: audio #${audio}${audio === 1 ? " (FIRST)" : ""}, event ${ev?.event_id}, ${kb} KB`);
        } else if (type === "agent_response") {
          const text = (m.agent_response_event as { agent_response?: string })?.agent_response ?? "";
          dlog(`network: agent response "${text.slice(0, 40)}"`);
        } else if (type === "user_transcript") {
          const text = (m.user_transcription_event as { user_transcript?: string })?.user_transcript ?? "";
          dlog(`network: user transcript "${text.slice(0, 40)}"`);
        } else if (type === "interruption") {
          dlog(`network: INTERRUPTION (event ${(m.interruption_event as { event_id?: number })?.event_id})`);
        } else {
          dlog(`network: ${type}`);
        }
      });
    }
  }
  window.WebSocket = LoggedWebSocket;

  document.addEventListener("visibilitychange", () => dlog(`page ${document.visibilityState}`));
  dlog("debug log ready");
}

if (DEBUG) install();
