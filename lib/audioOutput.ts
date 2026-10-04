// Backstop for iPhone sound.
//
// iOS only lets sound start inside a tap. The ElevenLabs SDK (1.8.1+) unlocks
// sound on the Start tap and keeps it for 30 seconds. If that has run out by
// the time Jordan connects (a slow permission prompt, or an earlier tap that
// started the 30 seconds), Jordan's player stays silent. His audio waits in
// the player meanwhile, so one more tap plays the opening line in full.
//
// The SDK keeps the player private, so we read it defensively. If a future
// SDK version renames these fields, the check returns false and nothing shows.

type PlayerInternals = {
  context?: unknown;
  audioElement?: unknown;
};

function playerOf(conversation: unknown): {
  context: AudioContext | null;
  audioElement: HTMLMediaElement | null;
} {
  const output = (conversation as { output?: PlayerInternals } | null)?.output;
  return {
    context:
      typeof AudioContext !== "undefined" && output?.context instanceof AudioContext
        ? output.context
        : null,
    audioElement:
      output?.audioElement instanceof HTMLMediaElement ? output.audioElement : null,
  };
}

export function isSoundBlocked(conversation: unknown): boolean {
  const { context, audioElement } = playerOf(conversation);
  return (
    (context !== null && context.state !== "running") ||
    (audioElement !== null && audioElement.paused)
  );
}

// Must be called from a tap.
export function turnSoundOn(conversation: unknown): Promise<void> {
  const { context, audioElement } = playerOf(conversation);
  return Promise.all([
    context?.resume().catch(() => {}),
    audioElement?.play().catch(() => {}),
  ]).then(() => {});
}
