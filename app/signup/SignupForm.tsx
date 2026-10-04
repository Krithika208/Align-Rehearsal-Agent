"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function SignupForm({
  action,
  initialAgeError,
}: {
  action: (formData: FormData) => Promise<void>;
  initialAgeError: boolean;
}) {
  const [ageError, setAgeError] = useState(initialAgeError);

  // Browser check: stop here so nothing typed is lost. The server action
  // checks again as a backstop.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const box = e.currentTarget.elements.namedItem("age_confirmed") as HTMLInputElement | null;
    if (!box?.checked) {
      e.preventDefault();
      setAgeError(true);
      box?.focus();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="auth-form">
      <label className="auth-label">
        Full name
        <input
          type="text"
          name="full_name"
          required
          autoComplete="name"
          className="auth-input"
        />
      </label>
      <label className="auth-label">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="auth-input"
        />
      </label>
      <label className="auth-label">
        Password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="auth-input"
        />
        <span className="auth-hint">At least 8 characters.</span>
      </label>
      <div className="auth-checkbox-row">
        <label className="auth-checkbox">
          <input
            type="checkbox"
            name="age_confirmed"
            value="yes"
            onChange={(e) => {
              if (e.target.checked) setAgeError(false);
            }}
          />
          I confirm I&apos;m 18 or over.
        </label>
        {ageError ? (
          <span className="auth-checkbox-error" role="alert">
            Align is for adults aged 18 and over. Please confirm your age
            to continue.
          </span>
        ) : null}
      </div>
      <button type="submit" className="btn-primary auth-submit">
        Create account
      </button>
      <p className="auth-consent">
        By signing up, you agree to our{" "}
        <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>, and acknowledge our{" "}
        <Link href="/disclaimer">AI Coaching Disclaimer</Link>.
      </p>
    </form>
  );
}
