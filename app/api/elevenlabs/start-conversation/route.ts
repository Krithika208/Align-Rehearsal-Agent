import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID must be set.",
      },
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
    scenario_slug?: string;
    relationship?: string;
    situation?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scenario_slug = body.scenario_slug?.trim();
  const relationship = body.relationship?.trim();
  const situation = body.situation?.trim();

  if (!scenario_slug || !relationship || !situation) {
    return NextResponse.json(
      { error: "scenario_slug, relationship and situation are required" },
      { status: 400 }
    );
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
    const text = await elRes.text();
    return NextResponse.json(
      { error: `ElevenLabs error (${elRes.status}): ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }
  const { signed_url } = (await elRes.json()) as { signed_url?: string };
  if (!signed_url) {
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
      situation,
      started_at: new Date().toISOString(),
      status: "in_progress",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: `Failed to record conversation: ${insertError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    conversation_db_id: inserted.id,
    signed_url,
  });
}
