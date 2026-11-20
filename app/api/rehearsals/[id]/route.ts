import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Deletes one of the signed-in user's saved rehearsals for good: the
// encrypted situation and transcript, its end signals and its outcome answers
// (rehearsal_outcomes cascades). A credit ledger row that points at it keeps
// its amount but loses the link, so the credit balance doesn't change.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Ownership check with the user's own client (RLS: own rows only).
  const { data: row } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Rehearsal not found" }, { status: 404 });
  }

  // conversations has no delete policy for users, so the server deletes it,
  // still limited to this user's row.
  const { error } = await createServiceRoleClient()
    .from("conversations")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[delete-rehearsal] failed:", error.message);
    return NextResponse.json({ error: "Couldn't delete this rehearsal." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
