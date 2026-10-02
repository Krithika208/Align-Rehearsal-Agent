import { NextResponse } from "next/server";
import {
  createClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

// Marks the signed-in user's founding call as claimed. The table is read-only
// to users, so the write goes through the service role, scoped to their row.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const claimedAt = new Date().toISOString();
  const { data, error } = await createServiceRoleClient()
    .from("founding_perks")
    .update({ claimed: true, claimed_at: claimedAt })
    .eq("user_id", user.id)
    .eq("claimed", false)
    .select("claimed_at");

  if (error) {
    return NextResponse.json(
      { error: `Failed to claim: ${error.message}` },
      { status: 500 }
    );
  }
  if (!data?.length) {
    return NextResponse.json(
      { error: "No unclaimed founding perk" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, claimed_at: claimedAt });
}
