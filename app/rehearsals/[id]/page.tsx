import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCENARIOS } from "../../app/scenarios";

export const metadata = {
  title: "Rehearsal — Align",
};

const SCENARIO_BY_SLUG = Object.fromEntries(
  SCENARIOS.map((s) => [s.slug, s])
);

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const time = d
    .toLocaleString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(" ", "");
  return `${day} ${month}, ${time}`;
}

type TranscriptTurn = { role: "user" | "agent"; text: string };

function normalizeTranscript(raw: unknown): TranscriptTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: TranscriptTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const source = typeof rec.source === "string" ? rec.source : "";
    const role: "user" | "agent" = source === "user" ? "user" : "agent";
    const message = typeof rec.message === "string" ? rec.message : "";
    const trimmed = message.trim();
    if (!trimmed) continue;
    turns.push({ role, text: trimmed });
  }
  return turns;
}

export default async function RehearsalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("conversations")
    .select(
      "id, scenario_slug, relationship, situation, started_at, duration_seconds, transcript"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!row) notFound();

  const scenario = row.scenario_slug
    ? SCENARIO_BY_SLUG[row.scenario_slug]
    : null;
  const title = scenario?.title ?? row.scenario_slug ?? "Rehearsal";
  const icon = scenario?.icon ?? "💬";
  const turns = normalizeTranscript(row.transcript);

  return (
    <main className="app-shell">
      <header className="app-header">
        <a href="/rehearsals" className="app-back">
          <span aria-hidden>←</span> My rehearsals
        </a>
        <a href="/app" className="auth-logo">
          align<span>.</span>
        </a>
      </header>
      <div className="app-inner app-inner-narrow">
        <div className="section-label">Rehearsal</div>
        <h1 className="app-heading">
          <span className="setup-icon" aria-hidden>
            {icon}
          </span>
          {title}
        </h1>
        <div className="rehearsal-meta">
          {row.relationship && <span>{row.relationship}</span>}
          <span>{formatDate(row.started_at)}</span>
          {row.duration_seconds ? (
            <span>
              {row.duration_seconds < 60
                ? `${row.duration_seconds} sec`
                : `${Math.round(row.duration_seconds / 60)} min`}
            </span>
          ) : null}
        </div>

        {row.situation && (
          <div className="rehearsal-situation">
            <div className="rehearsal-situation-label">The situation</div>
            <p>{row.situation}</p>
          </div>
        )}

        <div className="transcript-panel rehearsal-transcript">
          <div className="transcript-label">Transcript</div>
          <div className="transcript-scroll rehearsal-transcript-scroll">
            {turns.length === 0 ? (
              <div className="transcript-empty">
                No transcript saved for this rehearsal.
              </div>
            ) : (
              turns.map((turn, i) => (
                <div
                  key={i}
                  className={`transcript-turn transcript-turn-${turn.role}`}
                >
                  <div className="transcript-speaker">
                    {turn.role === "agent" ? "Jordan" : "You"}
                  </div>
                  <div className="transcript-text">{turn.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
