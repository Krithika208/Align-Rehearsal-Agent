# Align — Project Context

## Product

**Align** (the brand — not "Align Rehearsal").

A web app where people rehearse tough workplace conversations with a voice AI agent named **Jordan**. Jordan plays the other person, pushes back realistically, then breaks character at the end and delivers a coaching debrief.

B2C subscription. Built by Krithika (solo founder, ICF PCC-certified coach).

## Mission

Help people move from feeling **trapped at work** to feeling **empowered**, by letting them rehearse the conversations they've been avoiding.

## Scenarios

Five themes plus Custom (defined in `app/app/scenarios.ts`). Jordan receives the UPPERCASE label as `{{scenario}}`; the ElevenLabs prompt matches these exact strings.

1. Negotiate (`NEGOTIATE`)
2. Push back on a stakeholder (`PUSH BACK ON A STAKEHOLDER`)
3. Deliver tough feedback (`DELIVER TOUGH FEEDBACK`)
4. Receive difficult news (`RECEIVE DIFFICULT NEWS`)
5. Deliver difficult news (`DELIVER DIFFICULT NEWS`)
6. Custom (`CUSTOM`)

Relationship options: Manager, Direct report, Peer, Cofounder, Investor, Client, Other.

Voice: two Jordan agents (female default, male), same prompt. Choice saved as `preferred_voice` in the user's Supabase metadata. Env vars `ELEVENLABS_AGENT_FEMALE_ID` and `ELEVENLABS_AGENT_MALE_ID` (server-only).

## Pricing

- **Free:** $0, 5 rehearsals lifetime, no card
- **Paid:** $10/month or $100/year, one flat tier (Stripe lookup keys `align_monthly`, `align_annual`). Silent fair-use cap of 30 rehearsals/month.
- **Founding perk:** the first 100 paid users get a one-time 15-min call with Krithika (cal.com), shown on the complete screen and `/account` until claimed. A spot is used for good once allocated. Clicking "Book my call" claims nothing: the perk is claimed only when the Cal.com webhook (`app/api/cal/webhook/route.ts`) reports a `BOOKING_CREATED` for the `coaching-debrief` event type. It matches on `metadata[perk_ref]` (the row's opaque `booking_ref`, added to the in-app link), then falls back to the attendee's email (the welcome email has the plain link). Once claimed it stays claimed; cancellations and reschedules are ignored. Unmatched bookings are logged, not failed.
- **Account status:** `/account` reads the subscription live from Stripe. A portal cancellation shows "Cancels on [date]" and "Access until [date]"; reversing it restores the normal view. Statuses use friendly British labels (e.g. "Cancelled"), never raw Stripe values. When the plan has fully ended, `/account` shows a "Subscribe again" button to `/pricing`.
- **Resubscribing:** checkout is blocked only while a subscription is still running (any status except `canceled` / `incomplete_expired`); the block message links to `/account`. A returning customer goes through normal checkout, reusing their saved Stripe customer. The webhook's `checkout.session.completed` upsert (one row per user) replaces the ended subscription with the new one. Their founding spot, claim and welcome email are untouched: no second spot, no reset, no second email.
- **Session timing (all users):** app sends a time cue to Jordan at 15:00 and 18:00, and hangs up at 20:00. The cue strings in `app/app/AppClient.tsx` must match the ElevenLabs agent prompt exactly.

## Privacy

- Rehearsal transcripts and situations are encrypted in the app before saving (`lib/encryption.ts`, AES-256-GCM envelope encryption, key `ENCRYPTION_MASTER_KEY` in Vercel). Supabase only holds ciphertext. Decrypted only on `/rehearsals/[id]` for the owner.
- ElevenLabs data retention must be disabled on both Jordan agents (manual dashboard step).
- Cookie consent: `components/CookieBanner.tsx` + `lib/consent.ts` (localStorage, 365 days). Any analytics must check `hasAnalyticsConsent()` and listen for `CONSENT_EVENT` before loading. "Cookie preferences" in the footer reopens the banner.
- Auth emails (confirmation, password reset) come from Supabase via Resend SMTP as hello@livealign.co. Branded templates live in `emails/` and are pasted into Supabase by hand.
- The only app-sent email: Krithika's plain-text founding welcome (`lib/emails/founding-welcome.ts`), scheduled via Resend 3 days after a new founding perk is allocated in the Stripe webhook. `FOUNDING_EMAIL_DELAY_MINUTES` overrides the delay for testing.
- `rehearsal_outcomes` captures "did you have the real conversation?" on the complete screen. Delayed follow-up is future work.

## Build philosophy

Ship fast, iterate fast. Simplest thing that works. No over-engineering. No premature abstractions. Don't build for hypothetical future requirements.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind configured; most styles live in `app/globals.css`
- **Database + auth:** Supabase (email/password auth, RLS on all tables)
- **Payments:** Stripe. Prices are looked up by lookup key (`align_monthly`, `align_annual`), never hard-coded price IDs. Test or live mode follows whichever `STRIPE_SECRET_KEY` is set; `.env.local.example` assumes test keys.
- **Email:** Resend (SMTP for Supabase auth emails, API for the founding welcome)
- **Voice agent:** ElevenLabs Conversational AI, two Jordan agents
- **Analytics:** GA4 (`components/AnalyticsLoader.tsx`), loads only after cookie consent
- **Hosting:** Vercel, deployed from GitHub. Domain `livealign.co`; Vercel URL `align-rehearsal-agent.vercel.app`.

## Environment variables

Names only. Set in `.env.local` (gitignored) and Vercel (Production + Preview + Development):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_FEMALE_ID`, `ELEVENLABS_AGENT_MALE_ID`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `ENCRYPTION_MASTER_KEY` (never change or lose it: old transcripts become unreadable)
- `RESEND_API_KEY`
- `CAL_WEBHOOK_SECRET` (signing secret from the Cal.com webhook)
- `FOUNDING_EMAIL_DELAY_MINUTES` (optional, testing only)

`.env.local.example` lists `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, but no code uses it. It is missing `RESEND_API_KEY` and `FOUNDING_EMAIL_DELAY_MINUTES`.

## Database

Migrations live in `db/migrations/` and are run by hand in the Supabase SQL editor. Order:

1. `2026_05_12_conversations_schema.sql`
2. `2026_06_14_subscriptions_schema.sql`
3. `2026_06_14_subscriptions_billing_interval.sql`
4. `2026_09_27_pricing_v2.sql` (usage counters, founding perks, single tier)
5. `2026_09_30_encryption_and_outcomes.sql`
6. `2026_09_30_wipe_test_conversations.sql` (one-off, destructive)
7. `2026_09_30_drop_plaintext_columns.sql` (only once the encrypting code is live, which it now is on `main`)
8. `2026_10_02_founding_perk_booking.sql` (adds `booking_ref`, email lookup function, resets all click-based claims; run once)

The repo does not record which have been run. Check in Supabase before running anything.

Tables: `profiles`, `conversations`, `subscriptions`, `usage_counters`, `founding_perks`, `rehearsal_outcomes`.

## How to work with Krithika

1. **Always propose a plan before writing code.** List files you'll create, change, preserve.
2. **Wait for approval** before executing.
3. **Brief, concrete explanations.** Krithika is non-technical and learns by doing.
4. **Don't proactively start the next phase.** Stop when the current task is done.
5. **Cloud environment:** Krithika works in Claude Code's cloud, not locally. Push to a feature branch (not `main`) so Vercel auto-deploys a preview URL for review. Share the preview URL after each push. Merge to `main` only after explicit approval.

## What's done

- Launch v1 is on `main` (squash of `pricing-v2`, 2 Oct 2026): free + paid tiers, founding perk and welcome email, encryption at rest, outcome capture, cookie consent, branded Resend auth emails, GA4.
- `post-launch-fixes` merged to `main`: founding perk claimed only by a real Cal.com booking; `/account` shows a pending cancellation; friendly status labels.
- Branch `resubscribe-fix` (not yet on `main`): cancelled customers can subscribe again; header link "About" renamed "Coaching" (still to https://livealign.co).
- `pricing-v2` and `stripe-integration` have no changes that are not already on `main`. Safe to delete.

## Branches not on main

- `logo-swap`, `new-logo` (May 2026): early logo work, 30 commits behind. Probably stale.
- `setup-onboarding` (May 2026): welcome block on the rehearsal setup screen. Never merged.

## What's next / half-built

- Delayed outcome follow-up: columns exist in `rehearsal_outcomes`, nothing sends it (TODO in `2026_09_30_encryption_and_outcomes.sql`).
- Cal.com webhook setup (Settings → Developer → Webhooks, `BOOKING_CREATED` only, secret in `CAL_WEBHOOK_SECRET`).
- Manual checks: ElevenLabs retention off on both agents; Stripe live keys and live webhook in Vercel Production; Supabase email templates pasted from `emails/`.
