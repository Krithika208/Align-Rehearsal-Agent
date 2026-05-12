export type Scenario = {
  slug: string;
  icon: string;
  title: string;
  subhead: string;
};

export const SCENARIOS: Scenario[] = [
  {
    slug: "deliver-tough-feedback",
    icon: "💬",
    title: "Deliver tough feedback",
    subhead: "A colleague who pushes back when you raise it",
  },
  {
    slug: "negotiate",
    icon: "💰",
    title: "Negotiate",
    subhead: "When you need more than they want to give",
  },
  {
    slug: "push-back-on-stakeholder",
    icon: "🛡️",
    title: "Push back on a difficult stakeholder",
    subhead: "Holding your line when they hold the power",
  },
  {
    slug: "end-working-relationship",
    icon: "👋",
    title: "End a working relationship",
    subhead: "Letting someone go or parting ways",
  },
  {
    slug: "deliver-bad-news",
    icon: "📢",
    title: "Deliver bad news",
    subhead: "Saying what they may not want to hear",
  },
  {
    slug: "resign-with-grace",
    icon: "🚪",
    title: "Resign with grace",
    subhead: "When they're not ready to let you go",
  },
  {
    slug: "custom",
    icon: "✏️",
    title: "Custom",
    subhead: "Whatever's keeping you up at night",
  },
];

export const RELATIONSHIPS = [
  "Manager",
  "Direct report",
  "Peer",
  "Team",
  "Cofounder",
  "Investor/board",
  "Client",
  "Other",
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];
