// Personal plain-text note from Krithika to each founding member (first 100
// paid users), scheduled through Resend to arrive a few days after payment.
// Scheduled from the Stripe webhook; see app/api/stripe/webhook/route.ts.

export const FOUNDING_WELCOME_FROM = "Krithika <hello@livealign.co>";
export const FOUNDING_WELCOME_REPLY_TO = "hello@livealign.co";
export const FOUNDING_WELCOME_SUBJECT =
  "A thank you, and a coaching session with me";

export const FOUNDING_WELCOME_DELAY_MINUTES = 3 * 24 * 60; // 3 days

export function foundingWelcomeBody(firstName: string | null): string {
  return `${firstName ? `Hi ${firstName},` : "Hi there,"}

Thank you for being one of our first members. I hope you're enjoying working with Align!

As a founding member, I'd love to offer you a complimentary 15-minute 1:1 coaching session so we can continue to explore your situation at hand. You can book it here:
https://cal.com/krithika-align/coaching-debrief

We've built Align to mirror tough workplace dynamics, along with a coaching debrief rooted in International Coaching Federation principles. I'd love any feedback you're happy to share, including what has worked and what felt off. Just reply to this email.

See you on the call!

Krithika
Founder, Align
`;
}

// First word of the Supabase display name, or null if there isn't one.
export function firstNameFrom(displayName: unknown): string | null {
  if (typeof displayName !== "string") return null;
  const first = displayName.trim().split(/\s+/)[0];
  return first || null;
}

// FOUNDING_EMAIL_DELAY_MINUTES overrides the 3-day delay (for testing on
// preview). Anything that isn't a positive number is ignored.
function delayMinutes(): number {
  const override = Number(process.env.FOUNDING_EMAIL_DELAY_MINUTES);
  return Number.isFinite(override) && override > 0
    ? override
    : FOUNDING_WELCOME_DELAY_MINUTES;
}

// Schedules the email with Resend. Throws on any failure (missing key, API
// error); the caller logs it and carries on. The idempotency key stops a
// duplicate request for the same user from scheduling a second email.
export async function scheduleFoundingWelcomeEmail({
  userId,
  email,
  displayName,
}: {
  userId: string;
  email: string;
  displayName: unknown;
}): Promise<{ id: string; scheduledAt: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set; founding welcome email not scheduled.");
  }

  const scheduledAt = new Date(Date.now() + delayMinutes() * 60_000).toISOString();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `founding-welcome/${userId}`,
    },
    body: JSON.stringify({
      from: FOUNDING_WELCOME_FROM,
      to: [email],
      reply_to: FOUNDING_WELCOME_REPLY_TO,
      subject: FOUNDING_WELCOME_SUBJECT,
      text: foundingWelcomeBody(firstNameFrom(displayName)),
      scheduled_at: scheduledAt,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) {
    throw new Error(`Resend ${res.status}: ${data.message ?? "no email id returned"}`);
  }
  return { id: data.id, scheduledAt };
}
