"use client";

import { useState } from "react";
import type { FoundingPerk } from "@/lib/plans";

const CAL_URL = "https://cal.com/krithika-align/coaching-debrief";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Founding perk: a one-time 15-min call with Krithika for the first 100 paid
// users. "debrief" shows only while unclaimed; "account" also shows a quiet
// confirmation once claimed.
export default function FoundingPerkCard({
  perk,
  variant,
}: {
  perk: FoundingPerk;
  variant: "debrief" | "account";
}) {
  const [claimedAt, setClaimedAt] = useState<string | null>(
    perk.claimed ? perk.claimed_at ?? new Date().toISOString() : null
  );

  // The link opens cal.com itself (so pop-up blockers leave it alone); the
  // claim is sent alongside it with keepalive so it survives the tab switch.
  const claim = () => {
    fetch("/api/founding-perk/claim", { method: "POST", keepalive: true }).catch(
      () => {}
    );
    setClaimedAt(new Date().toISOString());
  };

  if (claimedAt) {
    if (variant === "debrief") return null;
    return (
      <p className="account-note perk-claimed">
        Founding call claimed on {formatDate(claimedAt)}.
      </p>
    );
  }

  return (
    <div className="perk-card">
      <p className="perk-text">
        {variant === "debrief"
          ? "As one of the first 100 members, you've unlocked a 15-min call with Krithika."
          : "Founding member perk: 15-min call with Krithika."}
      </p>
      <a
        href={CAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary perk-btn"
        onClick={claim}
      >
        Book my call →
      </a>
    </div>
  );
}
