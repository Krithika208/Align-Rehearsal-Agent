"use client";

import { useFormState } from "react-dom";
import PendingSubmit from "@/components/PendingSubmit";
import { submitWithdrawal, type WithdrawState } from "./actions";

const INITIAL: WithdrawState = { status: "idle" };

export default function WithdrawForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action] = useFormState(submitWithdrawal, INITIAL);

  if (state.status === "sent") {
    return (
      <p className="withdraw-sent" role="status">
        Thanks. We&apos;ve received your request and emailed you a copy.
        We&apos;ll reply within 14 days.
      </p>
    );
  }

  return (
    <form action={action} className="auth-form withdraw-form">
      <p className="withdraw-notice">
        I/We hereby give notice that I/we withdraw from my/our contract for
        the following purchase:
      </p>
      <label className="auth-label">
        Your name
        <input type="text" name="name" required maxLength={200} autoComplete="name" className="auth-input" />
      </label>
      <label className="auth-label">
        Email address on your Align account
        <input
          type="email"
          name="email"
          required
          maxLength={320}
          autoComplete="email"
          defaultValue={defaultEmail}
          className="auth-input"
        />
      </label>
      <label className="auth-label">
        Date of purchase
        <input type="date" name="purchase_date" required className="auth-input" />
      </label>
      <label className="auth-label">
        What you bought
        <select name="purchase" required defaultValue="" className="auth-input">
          <option value="" disabled>
            Choose one
          </option>
          <option value="1 rehearsal">1 rehearsal</option>
          <option value="5 rehearsals">5 rehearsals</option>
        </select>
      </label>
      <label className="auth-label">
        Anything else we should know (optional)
        <textarea name="notes" rows={3} maxLength={2000} className="auth-input" />
      </label>
      {/* Hidden from people; bots fill it in. */}
      <div className="withdraw-hp" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.status === "error" && (
        <p className="auth-error" role="alert">
          {state.message}
        </p>
      )}
      <PendingSubmit label="Send" pendingLabel="Sending..." />
    </form>
  );
}
