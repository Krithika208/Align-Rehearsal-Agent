import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: ELEVENLABS_API_KEY must be set." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    conversation_db_id?: string;
    el_conversation_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const conversation_db_id = body.conversation_db_id;
  const el_conversation_id = body.el_conversation_id;
  if (!conversation_db_id || !el_conversation_id) {
    return NextResponse.json(
      { error: "conversation_db_id and el_conversation_id are required" },
      { status: 400 }
    );
  }

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(
      el_conversation_id
    )}`,
    {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    }
  );
  if (!elRes.ok) {
    const text = await elRes.text();
    return NextResponse.json(
      { error: `ElevenLabs error (${elRes.status}): ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const elData = (await elRes.json()) as { transcript?: unknown };
  const transcript = Array.isArray(elData.transcript) ? elData.transcript : [];

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ transcript })
    .eq("id", conversation_db_id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update transcript: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
