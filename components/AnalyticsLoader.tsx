"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_EVENT, hasAnalyticsConsent } from "@/lib/consent";

const GA_ID = "G-WGDYQHTSLK";

declare global {
  interface Window {
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

// Removes GA's first-party cookies (_ga, _ga_<id>) when consent is withdrawn.
function deleteGaCookies() {
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

// Google Analytics 4, loaded only after the visitor clicks "Accept all" on the
// cookie banner. "Essential only" or no choice yet: nothing loads. If consent
// is withdrawn later (footer "Cookie preferences"), GA's own opt-out flag stops
// all further tracking and its cookies are removed.
export default function AnalyticsLoader() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const sync = () => {
      const ok = hasAnalyticsConsent();
      window[`ga-disable-${GA_ID}`] = !ok;
      if (!ok) deleteGaCookies();
      setConsented((was) => was || ok); // once loaded, the script stays; the flag gates it
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!consented) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
