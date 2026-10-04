"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEBUG, getLog, subscribeLog } from "@/lib/audioDebug";

const EMPTY: string[] = [];

// Audio debug log for /app, shown only with ?debug=1 in the address.
export default function DebugPanel() {
  // Only after mount, so the server render and first client render match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const lines = useSyncExternalStore(subscribeLog, getLog, () => EMPTY);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const bodyRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, open]);

  if (!mounted || !DEBUG) return null;

  const copy = async () => {
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch {
      // Older iOS: fall back to a hidden text box.
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      box.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      box.remove();
      setCopied(ok ? "Copied" : "Copy failed");
    }
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="debug-panel" role="log" aria-label="Audio debug log">
      <div className="debug-bar">
        <span className="debug-title">Debug log ({lines.length})</span>
        <button type="button" className="debug-btn" onClick={copy}>
          {copied ?? "Copy log"}
        </button>
        <button type="button" className="debug-btn" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <pre ref={bodyRef} className="debug-body">
          {lines.length ? lines.join("\n") : "Waiting. Tap Start rehearsal."}
        </pre>
      )}
    </div>
  );
}
