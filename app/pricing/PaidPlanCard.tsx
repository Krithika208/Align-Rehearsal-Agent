"use client";

import { useState } from "react";
import SubscribeButton from "@/components/SubscribeButton";

type Interval = "monthly" | "annual";

const PLANS: Record<Interval, { price: string; period: string; note: string }> = {
  monthly: { price: "$10", period: "/ month", note: "Billed monthly. Cancel anytime." },
  annual: { price: "$100", period: "/ year", note: "Billed yearly. Two months free." },
};

export default function PaidPlanCard() {
  const [interval, setBillingInterval] = useState<Interval>("monthly");
  const plan = PLANS[interval];

  return (
    <div className="pricing-plan">
      <div className="pricing-card">
        <div className="pricing-badge">Pro</div>
        <div className="pricing-toggle" role="group" aria-label="Billing interval">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`pricing-toggle-btn ${interval === value ? "pricing-toggle-active" : ""}`}
              aria-pressed={interval === value}
              onClick={() => setBillingInterval(value)}
            >
              {value === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
        <div className="pricing-amount">
          <span className="pricing-price">{plan.price}</span>
          <span className="pricing-period">{plan.period}</span>
        </div>
        <p className="pricing-note">{plan.note}</p>
        <SubscribeButton label="Subscribe" billingInterval={interval} />

        <ul className="pricing-features">
          <li>Unlimited rehearsals with Jordan</li>
          <li>All five themes, plus your own</li>
          <li>A coaching debrief after every conversation</li>
        </ul>
      </div>
      <p className="pricing-spots">
        First 100 founding members: 1:1 coaching conversation with leadership
        coach and Align Founder, Krithika Sridhar
      </p>
      <p className="pricing-scarcity">Limited spots left</p>
    </div>
  );
}
