import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptTranscript, toBytea } from "@/lib/encryption";

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
    conversation_db_id?: string;
    el_conversation_id?: string | null;
    transcript?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.conversation_db_id;
  if (!id) {
    return NextResponse.json(
      { error: "conversation_db_id is required" },
      { status: 400 }
    );
  }

  const { data: row, error: fetchError } = await supabase
    .from("conversations")
    .select("started_at, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const endedAt = new Date();
  const startedAt = row.started_at ? new Date(row.started_at) : endedAt;
  const duration_seconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  );

  const update: Record<string, unknown> = {
    ended_at: endedAt.toISOString(),
    duration_seconds,
    status: "completed",
    el_conversation_id: body.el_conversation_id ?? null,
  };
  // Encrypted before it leaves the server; never stored as plaintext. If the
  // key is missing this fails loudly and the transcript is not saved.
  if (Array.isArray(body.transcript)) {
    try {
      const enc = encryptTranscript(body.transcript, user.id);
      update.encrypted_content = toBytea(enc.ciphertext);
      update.encryption_iv = toBytea(enc.iv);
      update.encrypted_key = toBytea(enc.wrappedKey);
    } catch (err) {
      console.error("[end-conversation] encryption failed:", err);
      return NextResponse.json(
        { error: "Couldn't save your transcript." },
        { status: 500 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Empty outcome row for the "did you have the real conversation?" card.
  // Best-effort: the outcome endpoint creates it too if this fails.
  const { error: outcomeError } = await supabase.rpc("create_rehearsal_outcome", {
    p_rehearsal_id: id,
  });
  if (outcomeError) {
    console.error("[end-conversation] create_rehearsal_outcome failed:", outcomeError.message);
  }

  return NextResponse.json({ ok: true, duration_seconds });
}
