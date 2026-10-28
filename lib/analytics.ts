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
// True after consent is withdrawn while PostHog was running.
let withdrawn = false;

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

// Page addresses inside a recording, without their query string, like event
// URLs: full page loads (rrweb "meta" events, data.href) and in-app moves and
// other custom events such as $url_changed (data.payload.href / .url).
function scrubSnapshot(data: unknown): void {
  type Payload = Record<string, unknown>;
  for (const item of Array.isArray(data) ? data : [data]) {
    const d = (item as { data?: Payload } | null)?.data;
    if (!d || typeof d !== "object") continue;
    for (const target of [d, d.payload as Payload | undefined]) {
      if (!target || typeof target !== "object") continue;
      for (const key of ["href", "url"]) {
        if (typeof target[key] === "string") target[key] = stripQuery(target[key]);
      }
    }
  }
}

function beforeSend(event: CaptureResult | null): CaptureResult | null {
  // Consent is checked on every event, so anything captured after "Essential
  // only" (such as the recorder's final flush) is dropped, never sent.
  if (!event || !hasAnalyticsConsent()) return null;
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
    // Send each event as it is captured instead of batching every few
    // seconds, so nothing sits in a queue when consent is withdrawn.
    request_batching: false,
    // Opting out also removes PostHog's cookie and storage.
    opt_out_persistence_by_default: true,
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
    // Consent withdrawn while the library was still downloading.
    if (ph && !hasAnalyticsConsent()) {
      stopAnalytics();
      return null;
    }
    // Consent given again after being withdrawn.
    if (ph && withdrawn) {
      withdrawn = false;
      ph.__loaded = true;
      ph.opt_in_capturing();
      ph.startSessionRecording();
    }
    return ph;
  });
}

// Removes every PostHog cookie and storage key ("ph_..." and its opt-out flag
// "__ph_opt_in_out_..."). Also clears leftovers from an earlier visit.
function removePostHogStorage(): void {
  const isPostHog = (name: string) => name.startsWith("ph_") || name.startsWith("__ph_");
  try {
    const host = window.location.hostname;
    const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (!isPostHog(name)) continue;
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
      }
    }
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(store)) if (isPostHog(key)) store.removeItem(key);
    }
  } catch {
    /* storage blocked: nothing to remove */
  }
}

export function startAnalytics(): void {
  void load();
}

// No consent, or consent withdrawn ("Essential only" or "Cookie
// preferences"): stop at once, send nothing more, and remove PostHog's cookie
// and storage.
export function stopAnalytics(): void {
  if (client && !withdrawn) {
    withdrawn = true;
    try {
      client.stopSessionRecording();
      // reset() before opting out: in posthog-js reset() clears a stored
      // opt-out ("prefer calling reset() before opting in rather than after").
      client.reset();
      client.opt_out_capturing();
      // Every send path (direct sends, retries, the page-close beacon) checks
      // __loaded, so nothing already on its way out is sent.
      client.__loaded = false;
    } catch {
      /* ignore */
    }
  }
  removePostHogStorage();
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
