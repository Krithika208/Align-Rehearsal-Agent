"use client";

import { useState } from "react";

// "Delete this rehearsal" with an "Are you sure?" step. On success, goes back
// to Past rehearsals.
export default function DeleteRehearsalButton({ rehearsalId }: { rehearsalId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rehearsals/${rehearsalId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      window.location.href = "/rehearsals?deleted=1";
    } catch {
      setError("Couldn't delete this rehearsal. Please try again.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <div className="delete-block">
        <button type="button" className="delete-link" onClick={() => setConfirming(true)}>
          Delete this rehearsal
        </button>
      </div>
    );
  }

  return (
    <div className="delete-block delete-confirm" role="alertdialog" aria-labelledby="delete-q">
      <p id="delete-q" className="delete-question">
        Are you sure? This deletes the rehearsal and its transcript for good. You
        can&apos;t undo it.
      </p>
      <div className="delete-actions">
        <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting..." : "Yes, delete it"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setConfirming(false)}
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
