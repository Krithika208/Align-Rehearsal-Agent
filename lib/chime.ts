// One short, soft chime played through the page (not through the call), for
// the 17-minute wrap-up notice. Uses its own audio context, so Jordan's audio
// is untouched. If the browser won't play sound (no recent tap, iPhone), it
// gives up quietly.
export async function playChime(): Promise<boolean> {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    if (ctx.state !== "running") {
      void ctx.close().catch(() => {});
      return false;
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    // Soft attack, gentle fade, low volume.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.95);
    osc.onended = () => void ctx.close().catch(() => {});
    return true;
  } catch {
    return false;
  }
}
