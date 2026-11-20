// When an account is deleted and the app couldn't delete the PostHog person
// itself (no POSTHOG_PERSONAL_API_KEY on the free plan, or an error), this
// emails hello@livealign.co the user id so Krithika can delete them by hand.
// The Privacy Policy promises PostHog data is deleted within 30 days.
// Holds the Supabase user id only: never a name or email address.

export async function sendPostHogDeleteReminder(userId: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set; reminder not sent.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `posthog-delete/${userId}`,
    },
    body: JSON.stringify({
      from: "Align <hello@livealign.co>",
      to: ["hello@livealign.co"],
      subject: "Delete a person from PostHog",
      text: `Someone deleted their Align account on ${new Date().toUTCString()}. Please delete them from PostHog within 30 days.

User ID: ${userId}

1. Go to PostHog, then People.
2. Paste the user ID into the search box and open the person.
3. Click Delete person, and tick "also delete events".

If PostHog finds nobody, they never accepted analytics cookies and there is nothing to do.
`,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Resend ${res.status}: ${data.message ?? "send failed"}`);
  }
}
