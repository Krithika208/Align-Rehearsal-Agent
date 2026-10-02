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
// confirmation once claimed. Clicking the link claims nothing: the Cal.com
// webhook (/api/cal/webhook) marks the perk claimed when a booking is made,
// matched by the perk_ref metadata on the link.
export default function FoundingPerkCard({
  perk,
  variant,
}: {
  perk: FoundingPerk;
  variant: "debrief" | "account";
}) {
  if (perk.claimed) {
    if (variant === "debrief") return null;
    return (
      <p className="account-note perk-claimed">
        Founding call claimed
        {perk.claimed_at ? ` on ${formatDate(perk.claimed_at)}` : ""}.
      </p>
    );
  }

  const bookingUrl = `${CAL_URL}?${encodeURIComponent("metadata[perk_ref]")}=${encodeURIComponent(perk.booking_ref)}`;

  return (
    <div className="perk-card">
      <p className="perk-text">
        {variant === "debrief"
          ? "As one of the first 100 members, you've unlocked a 15-min call with Krithika."
          : "Founding member perk: 15-min call with Krithika."}
      </p>
      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary perk-btn"
      >
        Book my call →
      </a>
    </div>
  );
}
