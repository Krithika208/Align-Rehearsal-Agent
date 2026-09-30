import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const HOW_IT_WENT = ["better", "same", "worse"] as const;

// Saves the immediate "did you have the real conversation?" answers from the
// Rehearsal complete screen. The delayed follow-up is future work (see the
// TODO in db/migrations/2026_09_30_encryption_and_outcomes.sql).
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { had_conversation?: unknown; how_it_went?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.had_conversation !== "boolean") {
    return NextResponse.json(
      { error: "had_conversation must be true or false" },
      { status: 400 }
    );
  }
  const howItWent =
    body.how_it_went === undefined || body.how_it_went === null
      ? null
      : HOW_IT_WENT.find((v) => v === body.how_it_went);
  if (howItWent === undefined) {
    return NextResponse.json(
      { error: "how_it_went must be better, same or worse" },
      { status: 400 }
    );
  }

  // Make sure the row exists (normally created when the rehearsal ended).
  // Returns null if this user doesn't own the rehearsal.
  const { data: outcomeId, error: rpcError } = await supabase.rpc(
    "create_rehearsal_outcome",
    { p_rehearsal_id: params.id }
  );
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }
  if (!outcomeId) {
    return NextResponse.json({ error: "Rehearsal not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("rehearsal_outcomes")
    .update({
      had_conversation: body.had_conversation,
      how_it_went: body.had_conversation ? howItWent : null,
      answered_at: new Date().toISOString(),
    })
    .eq("id", outcomeId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
