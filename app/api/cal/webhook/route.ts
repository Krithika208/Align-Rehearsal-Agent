import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Cal.com signs the raw body with the webhook secret: HMAC-SHA256, hex, in the
// X-Cal-Signature-256 header. Read the raw body before parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPE_SLUG = "coaching-debrief";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CalWebhook = {
  triggerEvent?: string;
  payload?: {
    type?: string;
    uid?: string;
    metadata?: Record<string, unknown> | null;
    attendees?: { email?: string }[];
    responses?: { email?: string | { value?: string } };
  };
};

function signatureIsValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.replace(/^sha256=/, "").trim();
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

// Founding perk is claimed only by a real booking of the coaching-debrief call.
// Match on the perk_ref metadata from the in-app link first, then on the
// attendee's email (the founding welcome email holds the plain link). Once
// claimed it stays claimed: cancellations and reschedules are never handled.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!signatureIsValid(rawBody, request.headers.get("x-cal-signature-256"))) {
    console.error("[cal-webhook] rejected: missing or invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: CalWebhook;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const booking = body.payload;
  if (body.triggerEvent !== "BOOKING_CREATED" || booking?.type !== EVENT_TYPE_SLUG) {
    return NextResponse.json({ ignored: true });
  }

  const supabase = createServiceRoleClient();

  let userId: string | null = null;
  const ref = booking.metadata?.perk_ref;
  if (typeof ref === "string" && UUID_RE.test(ref)) {
    const { data } = await supabase
      .from("founding_perks")
      .select("user_id")
      .eq("booking_ref", ref)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }

  const responseEmail = booking.responses?.email;
  const email =
    booking.attendees?.[0]?.email ??
    (typeof responseEmail === "string" ? responseEmail : responseEmail?.value);
  if (!userId && email) {
    const { data, error } = await supabase.rpc("find_founding_perk_by_email", {
      p_email: email,
    });
    if (error) {
      console.error("[cal-webhook] email lookup failed:", error.message);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    userId = (data as string | null) ?? null;
  }

  if (!userId) {
    console.warn(
      `[cal-webhook] booking ${booking.uid ?? "(no uid)"} matched no founding member (perk_ref: ${typeof ref === "string" ? ref : "none"}, attendee: ${email ?? "none"})`
    );
    return NextResponse.json({ matched: false });
  }

  // .eq("claimed", false) leaves an existing claim and its date untouched.
  const { error } = await supabase
    .from("founding_perks")
    .update({ claimed: true, claimed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("claimed", false);
  if (error) {
    console.error(`[cal-webhook] failed to claim perk for ${userId}:`, error.message);
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }

  return NextResponse.json({ matched: true });
}
