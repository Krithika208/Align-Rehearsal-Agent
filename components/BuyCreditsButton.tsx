"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/plans";

// Starts a one-off Stripe Checkout for a credit pack.
export default function BuyCreditsButton({ pack }: { pack: CreditPackId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-credit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        if (res.status === 401) {
          window.location.href = "/login?redirectTo=/account";
          return;
        }
        setError(data.error ?? "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }
      track("checkout_started", { pack });
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="account-action">
      <button
        type="button"
        className="btn-primary"
        onClick={handleBuy}
        disabled={loading}
      >
        {loading ? "Redirecting…" : CREDIT_PACKS[pack].label}
      </button>
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
