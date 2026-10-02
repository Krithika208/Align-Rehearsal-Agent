// Cookie consent, stored in this browser's localStorage for 365 days.
// Essential cookies (Supabase auth/session) are always on. Anything
// non-essential, such as analytics, must check hasAnalyticsConsent() before it
// loads, and listen for CONSENT_EVENT to react when the choice changes.

export type ConsentChoice = "all" | "essential";

const STORAGE_KEY = "align_cookie_consent";
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export const CONSENT_EVENT = "align:consent-change";

export function getConsent(): ConsentChoice | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { choice, expires } = JSON.parse(raw) as {
      choice?: unknown;
      expires?: unknown;
    };
    if (typeof expires !== "number" || expires < Date.now()) return null;
    return choice === "all" || choice === "essential" ? choice : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ choice, expires: Date.now() + MAX_AGE_MS })
    );
  } catch {
    /* storage blocked: the banner simply shows again next visit */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

// Forget the choice so the banner shows again (footer "Cookie preferences").
export function clearConsent(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "all";
}
