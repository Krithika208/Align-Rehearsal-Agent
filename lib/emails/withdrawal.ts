// Withdrawal requests from /withdraw (UK and EEA 14-day right to cancel).
// Two plain-text emails: the request to hello@livealign.co, and a copy to
// the person, which is their confirmation of receipt. Refunds are done by
// hand in Stripe; nothing here touches payments or credits.

const FROM = "Align <hello@livealign.co>";
const INBOX = "hello@livealign.co";

export type WithdrawalRequest = {
  name: string;
  email: string;
  purchaseDate: string; // YYYY-MM-DD
  purchase: string; // "1 rehearsal" or "5 rehearsals"
  notes: string;
};

function details(r: WithdrawalRequest): string {
  return `I/We hereby give notice that I/we withdraw from my/our contract for the following purchase:

Name: ${r.name}
Email address on Align account: ${r.email}
Date of purchase: ${r.purchaseDate}
What was bought: ${r.purchase}
Anything else: ${r.notes || "(nothing)"}`;
}

async function send(apiKey: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Resend ${res.status}: ${data.message ?? "send failed"}`);
  }
}

// Throws if either email can't be sent, so the form can say so.
export async function sendWithdrawalEmails(r: WithdrawalRequest): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set; withdrawal not sent.");

  const received = new Date().toUTCString();

  await send(apiKey, {
    from: FROM,
    to: [INBOX],
    reply_to: r.email,
    subject: `Withdrawal request: ${r.purchase}, bought ${r.purchaseDate}`,
    text: `A withdrawal request came in through rehearse.livealign.co/withdraw on ${received}.

${details(r)}

Refund the unused credits from this purchase in Stripe, then reply to this email.`,
  });

  await send(apiKey, {
    from: FROM,
    to: [r.email],
    reply_to: INBOX,
    subject: "We've received your cancellation request",
    text: `Hi ${r.name},

We've received your request to cancel your purchase on ${received}. Here is a copy of what you sent:

${details(r)}

We'll reply within 14 days.

Align
hello@livealign.co
`,
  });
}
