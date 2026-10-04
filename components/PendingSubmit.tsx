"use client";

import { useFormStatus } from "react-dom";

// A form's submit button that disables itself while the request runs, so a
// double-click sends one request.
export default function PendingSubmit({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary auth-submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
