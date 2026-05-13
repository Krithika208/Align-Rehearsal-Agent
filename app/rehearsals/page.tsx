import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import { SCENARIOS } from "../app/scenarios";

export const metadata = {
  title: "My rehearsals — Align",
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

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

type ConversationRow = {
  id: string;
  scenario_slug: string | null;
  relationship: string | null;
  started_at: string | null;
  duration_seconds: number | null;
};

export default async function RehearsalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, scenario_slug, relationship, started_at, duration_seconds")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  const rows = (conversations ?? []) as ConversationRow[];

  return (
    <>
    <main className="app-shell">
      <header className="app-header">
        <a href="/app" className="auth-logo">
          align<span>.</span>
        </a>
        <div className="app-header-right">
          <a href="/app" className="app-nav-link">
            Back to rehearse
          </a>
        </div>
      </header>
      <div className="app-inner app-inner-narrow">
        <div className="section-label">Your history</div>
        <h1 className="app-heading">My rehearsals</h1>
        <p className="app-sub">
          Every conversation you&apos;ve rehearsed with Jordan. Tap one to read
          the transcript.
        </p>

        {rows.length === 0 ? (
          <div className="rehearsals-empty">
            <p>No rehearsals yet. Start your first one.</p>
            <a href="/app" className="btn-primary">
              Start a rehearsal
            </a>
          </div>
        ) : (
          <ul className="rehearsals-list">
            {rows.map((row) => {
              const scenario = row.scenario_slug
                ? SCENARIO_BY_SLUG[row.scenario_slug]
                : null;
              const title = scenario?.title ?? row.scenario_slug ?? "Rehearsal";
              const icon = scenario?.icon ?? "💬";
              return (
                <li key={row.id}>
                  <a href={`/rehearsals/${row.id}`} className="rehearsal-card">
                    <div className="rehearsal-card-icon" aria-hidden>
                      {icon}
                    </div>
                    <div className="rehearsal-card-body">
                      <h4>{title}</h4>
                      <div className="rehearsal-card-meta">
                        {row.relationship && <span>{row.relationship}</span>}
                        <span>{formatDate(row.started_at)}</span>
                        <span>{formatDuration(row.duration_seconds)}</span>
                      </div>
                    </div>
                    <div className="rehearsal-card-chev" aria-hidden>
                      →
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
    <SiteFooter />
    </>
  );
}
