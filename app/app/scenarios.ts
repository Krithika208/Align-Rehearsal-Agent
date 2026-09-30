export type Scenario = {
  slug: string;
  icon: string;
  title: string;
  // Sent to the ElevenLabs agent as {{scenario}}. The agent prompt matches
  // these exact strings — do not change them.
  label: string;
  subhead: string;
};

export const SCENARIOS: Scenario[] = [
  {
    slug: "negotiate",
    icon: "💰",
    title: "Negotiate",
    label: "NEGOTIATE",
    subhead: "Pay rise, promotion case, flexible working, budget or headcount",
  },
  {
    slug: "push-back-on-stakeholder",
    icon: "🛡️",
    title: "Push back on a stakeholder",
    label: "PUSH BACK ON A STAKEHOLDER",
    subhead: "Extra scope, unrealistic deadline, a colleague bypassing process",
  },
  {
    slug: "deliver-tough-feedback",
    icon: "💬",
    title: "Deliver tough feedback",
    label: "DELIVER TOUGH FEEDBACK",
    subhead:
      "Underperforming report, colleague not pulling their weight, feedback to your manager",
  },
  {
    slug: "receive-difficult-news",
    icon: "🌧️",
    title: "Receive difficult news",
    label: "RECEIVE DIFFICULT NEWS",
    subhead:
      "Poor performance review, promotion turned down, put on a PIP, redundancy meeting",
  },
  {
    slug: "deliver-difficult-news",
    icon: "📢",
    title: "Deliver difficult news",
    label: "DELIVER DIFFICULT NEWS",
    subhead:
      "Owning a mistake, missed target, resigning, letting someone go, ending a contract",
  },
  {
    slug: "custom",
    icon: "✏️",
    title: "Custom",
    label: "CUSTOM",
    subhead: "Whatever's keeping you up at night",
  },
];

// Titles for scenarios that have been retired, so older rehearsals in the
// history still show a proper name.
const LEGACY_SCENARIO_TITLES: Record<string, string> = {
  "end-working-relationship": "End a working relationship",
  "deliver-bad-news": "Deliver bad news",
  "resign-with-grace": "Resign with grace",
};

export function scenarioTitle(slug: string | null): string {
  if (!slug) return "Rehearsal";
  return (
    SCENARIOS.find((s) => s.slug === slug)?.title ??
    LEGACY_SCENARIO_TITLES[slug] ??
    slug
  );
}

export const RELATIONSHIPS = [
  "Manager",
  "Direct report",
  "Peer",
  "Cofounder",
  "Investor",
  "Client",
  "Other",
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

export type Voice = "female" | "male";
