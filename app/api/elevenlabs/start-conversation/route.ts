import { NextResponse } from "next/server";
import {
  createClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { FREE_SESSION_LIMIT, PAID_MONTHLY_FAIR_USE_CAP } from "@/lib/plans";
import { isPaymentIssue } from "@/lib/subscription";
import { encryptText, toBytea, type EncryptedField } from "@/lib/encryption";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    scenario_slug?: string;
    relationship?: string;
    situation?: string;
    voice?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scenario_slug = body.scenario_slug?.trim();
  const relationship = body.relationship?.trim();
  const situation = body.situation?.trim();

  // Two Jordan agents with identical prompts; only the voice differs.
  const voice = body.voice === "male" ? "male" : "female";
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId =
    voice === "male"
      ? process.env.ELEVENLABS_AGENT_MALE_ID
      : process.env.ELEVENLABS_AGENT_FEMALE_ID;
  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: ELEVENLABS_API_KEY, ELEVENLABS_AGENT_MALE_ID and ELEVENLABS_AGENT_FEMALE_ID must be set.",
      },
      { status: 500 }
    );
  }

  // Remember the choice for next time. Best-effort: never blocks the rehearsal.
  if (user.user_metadata?.preferred_voice !== voice) {
    await supabase.auth
      .updateUser({ data: { preferred_voice: voice } })
      .catch(() => {});
  }

  if (!scenario_slug || !relationship || !situation) {
    return NextResponse.json(
      { error: "scenario_slug, relationship and situation are required" },
      { status: 400 }
    );
  }

  // Encrypt the situation before anything else, so a missing key fails the
  // request without using up one of the user's sessions. Never stored as
  // plaintext.
  let encSituation: EncryptedField;
  try {
    encSituation = encryptText(situation, user.id, "situation");
  } catch (err) {
    console.error("[start-conversation] encryption failed:", err);
    return NextResponse.json(
      { error: "Couldn't start your rehearsal. Please try again later." },
      { status: 500 }
    );
  }

  // Count this session before connecting. In order:
  //   1. an active subscription: counted against the monthly fair-use cap
  //   2. free rehearsals (FREE_SESSION_LIMIT lifetime)
  //   3. credits: one is spent now, and given back below if the rehearsal
  //      fails to start, or later by end-conversation if it lasts under 60s
  // The free count is kept even if the ElevenLabs connection later fails.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  const status = sub?.status ?? "none";

  const service = createServiceRoleClient();
  let freeSessionsUsed: number | null = null;
  // The ledger row for the credit spent on this rehearsal, if any.
  let creditLedgerId: string | null = null;

  if (status === "active" || status === "trialing") {
    const { data: count, error } = await service.rpc(
      "increment_paid_session_count",
      { p_user_id: user.id }
    );
    if (error) {
      return NextResponse.json(
        { error: "Couldn't start your rehearsal. Please try again." },
        { status: 500 }
      );
    }
    if ((count as number) > PAID_MONTHLY_FAIR_USE_CAP) {
      return NextResponse.json(
        {
          error:
            "You've had 30 rehearsals this month — take a breath. Your fresh 30 arrive on the 1st.",
          code: "fair_use_cap",
        },
        { status: 429 }
      );
    }
  } else {
    const { data: count, error } = await service.rpc(
      "increment_free_session_count",
      { p_user_id: user.id }
    );
    if (error) {
      return NextResponse.json(
        { error: "Couldn't start your rehearsal. Please try again." },
        { status: 500 }
      );
    }

    if ((count as number) <= FREE_SESSION_LIMIT) {
      freeSessionsUsed = count as number;
    } else {
      // Free rehearsals used up: spend a credit.
      const { data: ledgerId, error: creditError } = await service.rpc(
        "spend_credit",
        { p_user_id: user.id }
      );
      if (creditError) {
        console.error("[start-conversation] spend_credit failed:", creditError.message);
        return NextResponse.json(
          { error: "Couldn't start your rehearsal. Please try again." },
          { status: 500 }
        );
      }
      if (!ledgerId) {
        if (isPaymentIssue(status)) {
          return NextResponse.json(
            { error: "There's a problem with your payment.", code: "payment_issue" },
            { status: 402 }
          );
        }
        return NextResponse.json(
          {
            error: `You've used your ${FREE_SESSION_LIMIT} free rehearsals.`,
            code: "free_limit_reached",
          },
          { status: 403 }
        );
      }
      creditLedgerId = ledgerId as string;
    }
  }

  // Gives the credit back if the rehearsal never got going. Best-effort.
  async function refundCredit(why: string) {
    if (!creditLedgerId) return;
    const { error } = await service
      .from("credit_ledger")
      .insert({ user_id: user!.id, delta: 1, reason: "refund" });
    if (error) {
      console.error(
        `[start-conversation] credit refund failed (${why}) for ledger row ${creditLedgerId}:`,
        error.message
      );
    }
  }

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(
      agentId
    )}`,
    {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    }
  );
  if (!elRes.ok) {
    await refundCredit("elevenlabs");
    const text = await elRes.text();
    return NextResponse.json(
      { error: `ElevenLabs error (${elRes.status}): ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }
  const { signed_url } = (await elRes.json()) as { signed_url?: string };
  if (!signed_url) {
    await refundCredit("no signed url");
    return NextResponse.json(
      { error: "ElevenLabs did not return a signed URL" },
      { status: 502 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      scenario_slug,
      relationship,
      encrypted_situation: toBytea(encSituation.ciphertext),
      situation_iv: toBytea(encSituation.iv),
      situation_key: toBytea(encSituation.wrappedKey),
      started_at: new Date().toISOString(),
      status: "in_progress",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    await refundCredit("conversation insert");
    return NextResponse.json(
      { error: `Failed to record conversation: ${insertError?.message}` },
      { status: 500 }
    );
  }

  // Link the credit to this rehearsal, so end-conversation can refund it if
  // the call is short. If this fails the rehearsal still goes ahead; it just
  // can't be refunded automatically.
  if (creditLedgerId) {
    const { error: linkError } = await service
      .from("credit_ledger")
      .update({ conversation_id: inserted.id })
      .eq("id", creditLedgerId);
    if (linkError) {
      console.error("[start-conversation] linking credit failed:", linkError.message);
    }
  }

  return NextResponse.json({
    conversation_db_id: inserted.id,
    signed_url,
    free_sessions_used: freeSessionsUsed,
  });
}
