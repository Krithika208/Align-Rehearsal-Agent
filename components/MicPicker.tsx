"use client";

import { useEffect, useState } from "react";
import {
  listMics,
  requestMicPermission,
  saveMicChoice,
  selectedMicId,
  type MicList,
} from "@/lib/microphone";

// Quiet "Microphone: [menu]" line on the setup screen. The choice is saved in
// this browser and read again by prepareMic() when the rehearsal starts.
export default function MicPicker() {
  const [list, setList] = useState<MicList | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await listMics();
        if (cancelled) return;
        setList(next);
        setSelected(selectedMicId(next));
      } catch {
        /* leave the menu hidden */
      }
    };
    void refresh();
    media.addEventListener("devicechange", refresh);
    return () => {
      cancelled = true;
      media.removeEventListener("devicechange", refresh);
    };
  }, []);

  if (!list) return null;

  const showMics = async () => {
    setAsking(true);
    try {
      await requestMicPermission();
      const next = await listMics();
      setList(next);
      setSelected(selectedMicId(next));
      setDenied(false);
    } catch {
      setDenied(true);
    } finally {
      setAsking(false);
    }
  };

  if (!list.hasPermission) {
    return (
      <div className="mic-choice">
        <span className="mic-choice-label">Microphone:</span>
        <span>{denied ? "blocked in your browser settings" : "your browser default"}</span>
        {!denied && (
          <button
            type="button"
            className="mic-choice-link"
            onClick={showMics}
            disabled={asking}
          >
            {asking ? "Waiting for permission…" : "Change"}
          </button>
        )}
      </div>
    );
  }

  if (list.mics.length === 0) return null;

  return (
    <div className="mic-choice">
      <label className="mic-choice-label" htmlFor="mic-select">
        Microphone:
      </label>
      <select
        id="mic-select"
        className="mic-choice-select"
        value={selected ?? ""}
        onChange={(e) => {
          const mic = list.mics.find((m) => m.deviceId === e.target.value);
          if (!mic) return;
          saveMicChoice(mic, list.autoId);
          setSelected(mic.deviceId);
        }}
      >
        {list.mics.map((m) => (
          <option key={m.deviceId} value={m.deviceId}>
            {m.label}
            {m.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
