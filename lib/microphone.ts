// Microphone choice for rehearsals.
//
// Why this exists: the ElevenLabs SDK asks for the mic with "ideal" hints
// (16 kHz, mono, voice isolation) and no device. Chrome scores every mic
// against those hints and can pick a better "match" over the system default,
// which on a Mac is often a nearby iPhone (Continuity). So we always resolve
// a specific device ourselves and pin every mic request to it.

const STORAGE_KEY = "align_mic";

export type Mic = {
  deviceId: string;
  label: string;
  isDefault: boolean;
};

export type MicList = {
  mics: Mic[];
  // False until the browser has granted mic access. Names and IDs are hidden
  // before then.
  hasPermission: boolean;
  // The mic we use when the user hasn't picked one.
  autoId: string | null;
};

type Saved = { deviceId: string; label: string };

export function isContinuityMic(label: string): boolean {
  return /iphone|ipad|continuity/i.test(label);
}

function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function clearSaved() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Picking the automatic mic clears the saved choice, so we keep following
// the browser default if it changes later.
export function saveMicChoice(mic: Mic, autoId: string | null) {
  try {
    if (mic.deviceId === autoId) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ deviceId: mic.deviceId, label: mic.label })
      );
    }
  } catch {
    /* ignore */
  }
}

export async function listMics(): Promise<MicList> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { mics: [], hasPermission: false, autoId: null };
  }
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === "audioinput"
  );
  const hasPermission = inputs.some((d) => d.label);
  if (!hasPermission) return { mics: [], hasPermission, autoId: null };

  // Chrome adds virtual "default" and "communications" entries that mirror a
  // real device. Use "default" to find the real one, but don't list it.
  const defaultEntry = inputs.find((d) => d.deviceId === "default");
  const real = inputs.filter(
    (d) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications"
  );
  let defaultId: string | null = null;
  if (defaultEntry) {
    const match =
      real.find((d) => defaultEntry.label.endsWith(d.label)) ??
      real.find((d) => d.groupId && d.groupId === defaultEntry.groupId);
    defaultId = match?.deviceId ?? null;
  }
  // Safari and Firefox have no "default" entry. They list the system default
  // first.
  if (!defaultId) defaultId = real[0]?.deviceId ?? null;

  const mics = real.map((d) => ({
    deviceId: d.deviceId,
    label: d.label,
    isDefault: d.deviceId === defaultId,
  }));

  // Use the default, unless it's an iPhone/Continuity mic and something else
  // is available. Those are only used when the user picks them.
  const defaultMic = mics.find((m) => m.isDefault);
  const autoId =
    defaultMic && !isContinuityMic(defaultMic.label)
      ? defaultMic.deviceId
      : mics.find((m) => !isContinuityMic(m.label))?.deviceId ??
        defaultId;

  return { mics, hasPermission, autoId };
}

// The user's saved choice if that mic is still plugged in, else the auto pick.
export function selectedMicId(list: MicList): string | null {
  const saved = loadSaved();
  if (saved) {
    const match =
      list.mics.find((m) => m.deviceId === saved.deviceId) ??
      list.mics.find((m) => m.label === saved.label);
    if (match) return match.deviceId;
  }
  return list.autoId;
}

// Shows the browser's permission prompt. The stream is closed straight away.
// No constraints, so the browser opens its default mic.
export async function requestMicPermission(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}

// Called just before a rehearsal. Makes sure we have permission, then returns
// the device every mic request in this rehearsal must use.
export async function prepareMic(): Promise<string | null> {
  let list = await listMics();
  if (!list.hasPermission) {
    await requestMicPermission();
    list = await listMics();
  }
  return selectedMicId(list);
}

// Runs `start` with every mic request pinned to `deviceId`. The SDK makes a
// permission-check request of its own with no device; this makes it open the
// same mic as the real one instead of letting the browser choose.
export async function withMic<T>(
  deviceId: string | null,
  start: () => Promise<T>
): Promise<T> {
  const media = navigator.mediaDevices;
  if (!deviceId || !media) return start();
  const original = media.getUserMedia;
  media.getUserMedia = (constraints?: MediaStreamConstraints) => {
    if (constraints?.audio) {
      const audio = constraints.audio === true ? {} : constraints.audio;
      if (!audio.deviceId) {
        constraints = {
          ...constraints,
          audio: { ...audio, deviceId: { exact: deviceId } },
        };
      }
    }
    return original.call(media, constraints);
  };
  try {
    return await start();
  } catch (err) {
    // The saved mic has gone (unplugged, or the browser reset its IDs).
    // Forget it so the next attempt uses the default.
    if (
      err instanceof Error &&
      (err.name === "OverconstrainedError" || err.name === "NotFoundError")
    ) {
      clearSaved();
    }
    throw err;
  } finally {
    media.getUserMedia = original;
  }
}
