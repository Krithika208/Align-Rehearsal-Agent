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
  globals.css          # Tailwind directives + migrated styles from original index.html
  (app)/               # placeholder — future authenticated app pages live here
  api/                 # placeholder — future API routes (Stripe webhooks, etc.)
components/
  ElevenLabsWidget.tsx # mounts the EL custom element + halo + startRehearsal handler
lib/                   # placeholder — future Supabase/Stripe clients & utilities
types/
  elevenlabs.d.ts      # TS declaration for the <elevenlabs-convai> custom element
```

## How to work with Krithika

1. **Always propose a plan before writing code.** List files you'll create, change, preserve.
2. **Wait for approval** before executing.
3. **Brief, concrete explanations.** Krithika is non-technical and learns by doing.
4. **Don't proactively start the next phase.** Stop when the current task is done.
5. **Cloud environment:** Krithika works in Claude Code's cloud, not locally. Push to a feature branch (not `main`) so Vercel auto-deploys a preview URL for review. Share the preview URL after each push. Merge to `main` only after explicit approval.

## What's done

- Migrated the original static `index.html` into a Next.js 14 App Router project. Marketing page lives at `/`. Visual parity preserved. ElevenLabs widget continues to work.

## What's next (not started)

- Auth provider integration
- Supabase setup (users, rehearsal sessions, usage tracking)
- Stripe integration (Founding 1,000 + standard tier)
- App pages behind login (scenario picker, rehearsal flow, history)
- ElevenLabs agent prompt engineering for the six launch scenarios
