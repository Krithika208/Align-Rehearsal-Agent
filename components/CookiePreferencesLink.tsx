"use client";

import { clearConsent } from "@/lib/consent";

// Reopens the cookie banner so visitors can change or withdraw consent.
export default function CookiePreferencesLink() {
  return (
    <button type="button" className="site-footer-btn" onClick={clearConsent}>
      Cookie preferences
    </button>
  );
}
