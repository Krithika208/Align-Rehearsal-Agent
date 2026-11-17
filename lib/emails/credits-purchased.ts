// Short plain-text email sent straight after a credit purchase, saying how
// many rehearsals were added. Sent from the Stripe webhook, once per Checkout
// session (the Resend idempotency key stops a repeat from sending twice).

import { firstNameFrom } from "@/lib/emails/founding-welcome";

const FROM = "Krithika <hello@livealign.co>";
const REPLY_TO = "hello@livealign.co";
const SUBJECT = "Your Align rehearsals are ready";

export function creditsPurchasedBody(firstName: string | null, credits: number): string {
  const added = credits === 1 ? "1 rehearsal" : `${credits} rehearsals`;
  const expire = credits === 1 ? "It never expires" : "They never expire";
  return `${firstName ? `Hi ${firstName},` : "Hi there,"}

Thanks for your purchase. We've added ${added} to your account. ${expire}, so use ${credits === 1 ? "it" : "them"} whenever you need.

Each rehearsal runs for up to 20 minutes.

Start a rehearsal: https://rehearse.livealign.co/app

Krithika
Founder, Align
`;
}

// Throws on any failure (missing key, API error); the caller logs it and
// carries on, so a failed email never stops the credits being added.
export async function sendCreditsPurchasedEmail({
  checkoutSessionId,
  email,
  displayName,
  credits,
}: {
  checkoutSessionId: string;
  email: string;
  displayName: unknown;
  credits: number;
}): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set; purchase email not sent.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `credits-purchased/${checkoutSessionId}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      reply_to: REPLY_TO,
      subject: SUBJECT,
      text: creditsPurchasedBody(firstNameFrom(displayName), credits),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) {
    throw new Error(`Resend ${res.status}: ${data.message ?? "no email id returned"}`);
  }
  return data.id;
}
