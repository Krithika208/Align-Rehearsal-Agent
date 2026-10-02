"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_EVENT,
  getConsent,
  setConsent,
  type ConsentChoice,
} from "@/lib/consent";

// Bottom bar for first-time visitors (or after "Cookie preferences" is used).
// Not blocking: the page stays usable while it's showing.
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(getConsent() === null);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!visible) return null;

  const choose = (choice: ConsentChoice) => setConsent(choice);

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <p className="cookie-text">
        We use cookies for essential site functionality and anonymous
        analytics.
      </p>
      <div className="cookie-actions">
        <button
          type="button"
          className="cookie-btn cookie-btn-primary"
          onClick={() => choose("all")}
        >
          Accept all
        </button>
        <button
          type="button"
          className="cookie-btn"
          onClick={() => choose("essential")}
        >
          Essential only
        </button>
        <Link href="/privacy#cookies-and-analytics" className="cookie-link">
          Learn more
        </Link>
      </div>
    </div>
  );
}
