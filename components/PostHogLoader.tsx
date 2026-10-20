"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, hasAnalyticsConsent } from "@/lib/consent";
import { createClient } from "@/lib/supabase/client";
import {
  forgetUser,
  identifyUser,
  startAnalytics,
  stopAnalytics,
  track,
  trackPageview,
} from "@/lib/analytics";

// PostHog, loaded only after "Accept all" (see lib/analytics.ts). Sends a page
// view on every route, plus pricing_viewed and subscription_started, and
// identifies signed-in users by their Supabase user id.
export default function PostHogLoader() {
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const sync = () => {
      const ok = hasAnalyticsConsent();
      if (ok) startAnalytics();
      else stopAnalytics();
      setConsented(ok);
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  // Identify by Supabase user id only, and forget on sign-out.
  useEffect(() => {
    if (!consented) return;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) identifyUser(data.user.id);
      })
      .catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") forgetUser();
      else if (session?.user) identifyUser(session.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, [consented]);

  useEffect(() => {
    if (!consented) return;
    trackPageview();
    if (pathname === "/pricing") track("pricing_viewed");
    if (
      pathname === "/app" &&
      new URLSearchParams(window.location.search).get("subscription") === "success"
    ) {
      track("subscription_started");
    }
  }, [consented, pathname]);

  return null;
}
