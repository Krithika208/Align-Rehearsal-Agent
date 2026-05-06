"use client";

import Script from "next/script";
import { useEffect } from "react";

const AGENT_ID = "agent_4201km5t35czer3a5q7m43s0fkvw";

export default function ElevenLabsWidget() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(".btn-primary, .widget-callout, elevenlabs-convai")
      ) {
        const halo = document.getElementById("widgetHalo");
        if (halo) halo.style.display = "none";
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <div className="widget-halo" id="widgetHalo" />
      <elevenlabs-convai agent-id={AGENT_ID}></elevenlabs-convai>
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
      />
    </>
  );
}

type ToastTimer = number | undefined;
declare global {
  interface HTMLElement {
    _toastTimer?: ToastTimer;
  }
}

function showToast(message: string, durationMs = 3500) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  if (toast._toastTimer) window.clearTimeout(toast._toastTimer);
  toast._toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, durationMs);
}

export function startRehearsal(event?: React.MouseEvent) {
  if (event) event.preventDefault();

  const widget = document.querySelector(
    "elevenlabs-convai"
  ) as HTMLElement | null;

  const widgetReady =
    widget &&
    (widget.shadowRoot ||
      widget.children.length > 0 ||
      widget.offsetHeight > 0);

  if (!widgetReady) {
    showToast(
      "Voice agent is still loading — try again in a moment, or check your connection.",
      4000
    );
    return;
  }

  try {
    widget.scrollIntoView({ behavior: "smooth", block: "end" });
  } catch {
    /* ignore */
  }

  widget.click();

  if (widget.shadowRoot) {
    const innerButton = widget.shadowRoot.querySelector<HTMLElement>(
      'button, [role="button"]'
    );
    if (innerButton) innerButton.click();
  }
}
