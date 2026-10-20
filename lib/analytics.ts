// PostHog product analytics and session recordings.
//
// Gated exactly like Google Analytics (components/AnalyticsLoader.tsx): nothing
// loads until the visitor chooses "Accept all" on the cookie banner, and
// "Essential only" means no PostHog at all. Withdrawing consent stops capture
// and recording at once.
//
// Privacy rules:
// - Recordings mask every word: all text on the page and everything typed.
//   They show layout, clicks, scrolling and page moves only.
// - Users are identified by their Supabase user id only. Never email or name.
// - No click autocapture, heatmaps, surveys or feature flags.
// - Events carry fixed labels and numbers only, never free text.
// - URLs are sent without their query string (it can hold error messages,
//   tokens or Stripe session ids).
//
// Key and host come from NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST.
// If either is missing, PostHog stays off quietly.

import type { CaptureResult, PostHog } from "posthog-js";
import { hasAnalyticsConsent } from "@/lib/consent";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// The library itself is only downloaded after consent.
let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

const URL_PROPS = ["$current_url", "$referrer", "$initial_referrer", "$initial_current_url"];

function stripQuery(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.split(/[?#]/)[0];
}

// Attributes that hold on-screen or spoken words (the situation box's
// placeholder, screen-reader labels, tooltips, image descriptions, form values).
// Masked in recordings like text. Layout attributes (class, style) stay.
const WORD_ATTRIBUTES = new Set([
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "title",
  "alt",
  "label",
  "value",
  "content",
]);

function maskAttribute(name: string, value: string): string {
  return WORD_ATTRIBUTES.has(name.toLowerCase()) ? value.replace(/\S/g, "*") : value;
}

// Page addresses inside a recording (rrweb "meta" events), without their
// query string, like event URLs.
function scrubSnapshot(data: unknown): void {
  for (const item of Array.isArray(data) ? data : [data]) {
    const d = (item as { type?: number; data?: { href?: unknown } } | null)?.data;
    if ((item as { type?: number })?.type === 4 && d && typeof d.href === "string") {
      d.href = stripQuery(d.href);
    }
  }
}

function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  if (event.properties) {
    // The page title is words; the path already says which page it was.
    delete event.properties.title;
    if (event.event === "$snapshot") scrubSnapshot(event.properties.$snapshot_data);
  }
  for (const key of URL_PROPS) {
    if (event.properties && key in event.properties) {
      event.properties[key] = stripQuery(event.properties[key]);
    }
    if (event.$set && key in event.$set) event.$set[key] = stripQuery(event.$set[key]);
    if (event.$set_once && key in event.$set_once) {
      event.$set_once[key] = stripQuery(event.$set_once[key]);
    }
  }
  return event;
}

function init(posthog: PostHog): PostHog {
  posthog.init(KEY!, {
    api_host: HOST,
    person_profiles: "identified_only",
    // Page views are sent by components/PostHogLoader.tsx on each route.
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    enable_heatmaps: false,
    disable_surveys: true,
    disable_product_tours: true,
    disable_web_experiments: true,
    advanced_disable_feature_flags: true,
    capture_exceptions: false,
    capture_performance: false,
    enable_recording_console_log: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    session_recording: {
      maskAllInputs: true,
      // Every text node on every page, not just inputs.
      maskTextSelector: "*",
      // Words held in attributes, such as the situation box's placeholder.
      maskAttributeFn: maskAttribute,
    },
    before_send: beforeSend,
  });
  return posthog;
}

// Loads and starts PostHog if the visitor has accepted analytics, else null.
// Safe to call often.
function load(): Promise<PostHog | null> {
  if (!KEY || !HOST || !hasAnalyticsConsent()) return Promise.resolve(null);
  if (!loading) {
    loading = import("posthog-js")
      .then(({ default: posthog }) => (client = init(posthog)))
      .catch(() => {
        loading = null;
        return null;
      });
  }
  return loading.then((ph) => {
    // Consent given again after being withdrawn.
    if (ph?.has_opted_out_capturing()) {
      ph.opt_in_capturing();
      ph.startSessionRecording();
    }
    return ph;
  });
}

export function startAnalytics(): void {
  void load();
}

// Consent withdrawn ("Essential only" or "Cookie preferences"): stop at once.
export function stopAnalytics(): void {
  if (!client) return;
  try {
    client.stopSessionRecording();
    client.opt_out_capturing();
    client.reset();
  } catch {
    /* ignore */
  }
}

// Labels and numbers only. Never pass free text.
export function track(
  event: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  void load().then((ph) => {
    try {
      ph?.capture(event, properties);
    } catch {
      /* analytics never breaks the app */
    }
  });
}

export function trackPageview(): void {
  const url = window.location.origin + window.location.pathname;
  void load().then((ph) => {
    try {
      ph?.capture("$pageview", { $current_url: url });
    } catch {
      /* ignore */
    }
  });
}

// Supabase user id only. Never email or name.
export function identifyUser(userId: string): void {
  void load().then((ph) => {
    try {
      if (ph && ph.get_distinct_id() !== userId) ph.identify(userId);
    } catch {
      /* ignore */
    }
  });
}

export function forgetUser(): void {
  try {
    client?.reset();
  } catch {
    /* ignore */
  }
}
