import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import { decryptText, decryptTranscript, fromBytea } from "@/lib/encryption";
import { SCENARIOS, scenarioTitle } from "../../app/scenarios";

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
      "id, scenario_slug, relationship, started_at, duration_seconds, encrypted_content, encryption_iv, encrypted_key, encrypted_situation, situation_iv, situation_key"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!row) notFound();

  const scenario = row.scenario_slug
    ? SCENARIO_BY_SLUG[row.scenario_slug]
    : null;
  const title = scenarioTitle(row.scenario_slug);
  const icon = scenario?.icon ?? "💬";
  // Decrypted only here, for the owner. Throws (error page) if the key is
  // missing or a blob doesn't belong to this user.
  const situation =
    row.encrypted_situation && row.situation_iv && row.situation_key
      ? decryptText(
          {
            ciphertext: fromBytea(row.encrypted_situation),
            iv: fromBytea(row.situation_iv),
            wrappedKey: fromBytea(row.situation_key),
          },
          user.id,
          "situation"
        )
      : null;
  const turns =
    row.encrypted_content && row.encryption_iv && row.encrypted_key
      ? normalizeTranscript(
          decryptTranscript(
            {
              ciphertext: fromBytea(row.encrypted_content),
              iv: fromBytea(row.encryption_iv),
              wrappedKey: fromBytea(row.encrypted_key),
            },
            user.id
          )
        )
      : [];

  return (
    <>
    <main className="app-shell">
      <header className="app-header">
        <a href="/rehearsals" className="app-back">
          <span aria-hidden>←</span> My rehearsals
        </a>
        <div className="app-header-right">
          <a href="/app" className="auth-logo">
            align<span>.</span>
          </a>
          <a href="https://livealign.co" className="app-nav-link">
            About
          </a>
        </div>
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

        {situation && (
          <div className="rehearsal-situation">
            <div className="rehearsal-situation-label">The situation</div>
            <p>{situation}</p>
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
    <SiteFooter />
    </>
  );
}
