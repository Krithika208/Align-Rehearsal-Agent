# Align — Project Context

## Product

**Align** (the brand — not "Align Rehearsal").

A web app where people rehearse tough workplace conversations with a voice AI agent named **Jordan**. Jordan plays the other person, pushes back realistically, then breaks character at the end and delivers a coaching debrief.

B2C subscription. Built by Krithika (solo founder, ICF PCC-certified coach).

## Mission

Help people move from feeling **trapped at work** to feeling **empowered**, by letting them rehearse the conversations they've been avoiding.

## Six launch scenarios

**Workplace**
1. Negotiate a raise or promotion
2. Push back on a difficult stakeholder
3. Deliver difficult feedback to a stakeholder

**Founder**
4. Pitch investors with shaky metrics
5. Difficult conversation with a co-founder
6. Let go of an early employee

> "Stakeholder" = anyone (manager, peer, direct report, cross-functional partner). Before each rehearsal, the agent setup asks who the stakeholder is to the user.

## Pricing

- **Founding 1,000:** £3.99/month — 5 rehearsals/month cap, grandfathered for 12 months
- **Standard:** £8.99/month after the founding cohort fills

## Build philosophy

Ship fast, iterate fast. Simplest thing that works. No over-engineering. No premature abstractions. Don't build for hypothetical future requirements.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind (configured but homepage currently uses migrated inline CSS from the original static page in `app/globals.css`)
- **Database:** Supabase — *not yet added*
- **Auth:** TBD — *not yet added*
- **Payments:** Stripe — *not yet added*
- **Voice agent:** ElevenLabs Conversational AI (existing agent, embedded via the official `<elevenlabs-convai>` widget)
- **Hosting:** Vercel, deployed from GitHub. Live at `align-rehearsal-agent.vercel.app`. Long-term domain: `livealign.co`.

## Repo layout

```
app/
  layout.tsx           # root layout, fonts, metadata
  page.tsx             # marketing homepage (Client Component, interactive CTAs)
  globals.css          # Tailwind directives + migrated styles + auth-page styles
  login/page.tsx       # email/password login (server action)
  signup/page.tsx      # email/password signup (server action; sends confirmation email)
  auth/callback/route.ts # handles email-confirmation redirect → exchanges code for session
  app/page.tsx         # logged-in landing (protected by middleware) — currently shows email + logout
  api/                 # placeholder — future API routes (Stripe webhooks, etc.)
components/
  ElevenLabsWidget.tsx # mounts the EL custom element + halo + startRehearsal handler
lib/
  supabase/
    client.ts          # browser client (createBrowserClient)
    server.ts          # server client w/ cookie adapters (Server Components, Actions, Routes)
    middleware.ts      # session-refresh helper used by root middleware.ts
middleware.ts          # protects /app/* — redirects unauthenticated users to /login
types/
  elevenlabs.d.ts      # TS declaration for the <elevenlabs-convai> custom element
```

## Environment variables

Required in both `.env.local` (gitignored) and Vercel project settings (Production + Preview + Development):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable key (formerly "anon key"; format is now `sb_publishable_…` — `@supabase/ssr` accepts either format)

## Database

Schema managed in Supabase (no migrations checked into the repo yet). Tables:

- `profiles` — one row per user, FK to `auth.users`. Auto-created via trigger on signup.
- `conversations` — one row per rehearsal session (transcript stored as jsonb).

Row-Level Security is enabled on both tables; users can only read/write their own rows.

## How to work with Krithika

1. **Always propose a plan before writing code.** List files you'll create, change, preserve.
2. **Wait for approval** before executing.
3. **Brief, concrete explanations.** Krithika is non-technical and learns by doing.
4. **Don't proactively start the next phase.** Stop when the current task is done.
5. **Cloud environment:** Krithika works in Claude Code's cloud, not locally. Push to a feature branch (not `main`) so Vercel auto-deploys a preview URL for review. Share the preview URL after each push. Merge to `main` only after explicit approval.

## What's done

- Migrated the original static `index.html` into a Next.js 14 App Router project. Marketing page lives at `/`. Visual parity preserved. ElevenLabs widget continues to work.
- Vercel framework preset set to **Next.js** (build/install/output settings auto-detected from `package.json`).
- Supabase auth wired up: signup, email confirmation, login, logout. `/app` is gated by middleware. `profiles` and `conversations` tables exist in Supabase with RLS.

## What's next (not started)

- Stripe integration (Founding 1,000 + standard tier) + usage caps (5 rehearsals/month for founding)
- Scenario picker UI at `/app` (six launch scenarios)
- Rehearsal flow: scenario setup → ElevenLabs session → write to `conversations` table → debrief view
- ElevenLabs agent prompt engineering for the six launch scenarios
- Profile editing UI
- Password reset / OAuth providers / custom email templates
