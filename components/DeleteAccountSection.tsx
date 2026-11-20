"use client";

import { useState } from "react";
import { forgetUser } from "@/lib/analytics";

// "Delete my account" on /account: an "Are you sure?" step where the user
// types DELETE, then the account and everything tied to it is removed.
export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't delete your account. Please try again.");
        setDeleting(false);
        return;
      }
      forgetUser();
      window.location.href = "/";
    } catch {
      setError("Network error. Please check your connection and try again.");
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <div className="delete-block">
        <button type="button" className="delete-link" onClick={() => setOpen(true)}>
          Delete my account
        </button>
      </div>
    );
  }

  return (
    <div className="delete-block" role="alertdialog" aria-labelledby="delete-account-q">
      <p id="delete-account-q" className="delete-question">
        Are you sure? This deletes your account, all your rehearsals and any
        credits you have left, for good. You can&apos;t undo it.
      </p>
      <label className="auth-label delete-type">
        Type DELETE to confirm
        <input
          type="text"
          className="auth-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </label>
      <div className="delete-actions">
        <button
          type="button"
          className="btn-danger"
          onClick={handleDelete}
          disabled={typed !== "DELETE" || deleting}
        >
          {deleting ? "Deleting..." : "Delete my account"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          disabled={deleting}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
