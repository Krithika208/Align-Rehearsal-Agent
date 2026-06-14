"use client";

import { useState } from "react";

export default function SubscribeButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageHref, setManageHref] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    setManageHref(null);

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          // Not signed in — send them to log in, then back to pricing.
          window.location.href = "/login?redirectTo=/pricing";
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        if (data.manage) setManageHref(data.manage);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Could not start checkout. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pricing-cta">
      <button
        type="button"
        className="btn-primary"
        onClick={handleSubscribe}
        disabled={loading}
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && (
        <p className="pricing-error" role="alert">
          {error}{" "}
          {manageHref && (
            <a href={manageHref} className="pricing-error-link">
              Go to your account
            </a>
          )}
        </p>
      )}
    </div>
  );
}
