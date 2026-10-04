"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type MenuLink = { href: string; label: string };

const COACHING = "https://livealign.co";

// Every link a phone menu can show, in this order. A link appears when the
// page's own header shows it, or when it's always in the menu for this user.
const MENU_ORDER: { href: string; label: string; loggedIn?: boolean; loggedOut?: boolean }[] = [
  { href: "/pricing", label: "Pricing", loggedOut: true },
  { href: "/app", label: "Rehearse", loggedIn: true },
  { href: "/rehearsals", label: "Past rehearsals" },
  { href: "/account", label: "Account", loggedIn: true },
  { href: COACHING, label: "Coaching", loggedIn: true, loggedOut: true },
  { href: "/login", label: "Sign in", loggedOut: true },
];

// Signs out, then loads the homepage fresh. If Supabase can't be reached the
// user is still signed in, so say so rather than pretending it worked.
async function logOut(): Promise<boolean> {
  try {
    const { error } = await createClient().auth.signOut();
    if (error) return false;
  } catch {
    return false;
  }
  window.location.href = "/";
  return true;
}

// The links in a page header. On wide screens they show in a row, plus
// "Log out" when signed in. Below 800px they fold into a three-line menu.
export default function HeaderMenu({
  links,
  loggedIn,
  variant,
  before,
}: {
  links: MenuLink[];
  loggedIn: boolean;
  // "site": the uppercase marketing header. "app": the /app-style header.
  variant: "site" | "app";
  // Shown before the links on wide screens only (the /app greeting).
  before?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onPage = new Set(links.map((l) => l.href));
  const menuLinks = MENU_ORDER.filter(
    (l) => onPage.has(l.href) || (loggedIn ? l.loggedIn : l.loggedOut)
  ).map((l) => ({ href: l.href, label: links.find((x) => x.href === l.href)?.label ?? l.label }))
    // "Rehearse" and the /rehearsals page header's "Back to rehearse" both go
    // to /app; the menu always calls it "Rehearse".
    .map((l) => (l.href === "/app" ? { ...l, label: "Rehearse" } : l));

  const linkClass = variant === "site" ? "nav-link" : "app-nav-link";
  const logoutClass = variant === "site" ? "nav-link nav-logout" : "app-logout";

  const doLogOut = async () => {
    setLoggingOut(true);
    if (!(await logOut())) {
      setLoggingOut(false);
      window.alert("We couldn't log you out. Please check your connection and try again.");
    }
  };

  return (
    <div className="hm" ref={ref}>
      <div className={variant === "site" ? "nav-links hm-row" : "app-header-right hm-row"}>
        {before}
        {links.map((l) => (
          <a key={l.href} href={l.href} className={linkClass}>
            {l.label}
          </a>
        ))}
        {loggedIn && (
          <button type="button" className={logoutClass} onClick={doLogOut} disabled={loggingOut}>
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        )}
      </div>

      <button
        type="button"
        className="hm-toggle"
        aria-label={open ? "Close menu" : "Menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="hm-panel" id={panelId}>
          {menuLinks.map((l) => (
            <a key={l.href} href={l.href} className="hm-item" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          {loggedIn && (
            <button type="button" className="hm-item hm-logout" onClick={doLogOut} disabled={loggingOut}>
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
