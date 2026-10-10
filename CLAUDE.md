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
- **20-minute cap:** on `/pricing`, both cards say "up to 20 minutes each" (Free: "5 lifetime rehearsals with Jordan, up to 20 minutes each"; Paid: "Unlimited rehearsals with Jordan, up to 20 minutes each"), and a muted centred line below the cards says "Each rehearsal runs for up to 20 minutes, including your debrief. Pro is subject to fair use." ("fair use" links to `/terms`). The setup screen has a muted line under "Start rehearsal": "You have up to 20 minutes, including your debrief. Real conversations come with a clock too." The homepage does not repeat the cap.
- **Founding perk block on `/pricing`:** inside the paid card, centred. The "First 100 members" pill keeps the standard teal badge style; the two lines under it ("A free 1:1 coaching session with Krithika, Align's founder." and "Limited spots left.") are gold, `var(--amber)` (#C4943A), the colour they had before the block moved inside the card.
- **Session timing (all users):** app sends a time cue to Jordan at 15:00 and 18:00, and hangs up at 20:00. The cue strings in `app/app/AppClient.tsx` must match the ElevenLabs agent prompt exactly.

## Privacy

- Rehearsal transcripts and situations are encrypted in the app before saving (`lib/encryption.ts`, AES-256-GCM envelope encryption, key `ENCRYPTION_MASTER_KEY` in Vercel). Supabase only holds ciphertext. Decrypted only on `/rehearsals/[id]` for the owner.
- ElevenLabs Zero Retention Mode is on for both Jordan agents (confirmed by the founders, 2 October 2026). The Privacy Policy relies on this; keep it on for any new agent.
- Supabase region is West EU (Ireland), `eu-west-1` (confirmed by the founders, 4 October 2026). The Privacy Policy says data is stored in Ireland.
- Age confirmation: `/signup` (the only sign-up route) has an unticked "I confirm I'm 18 or over." box. Without it, `app/signup/SignupForm.tsx` blocks the submit in the browser and shows the adults-only message by the box, keeping what was typed. The server action checks again as a backstop (stops before calling Supabase: no account, no email; the page reloads with the message and empty fields, password never pre-filled). While the request runs, the button is disabled and reads "Creating your account..." (`useFormStatus`), so a double-click sends one request. Supabase's repeat-email rate limit (`over_email_send_rate_limit`, "For security purposes...") is shown as "We've just sent you an email. Please check your inbox, or try again in a minute." Sign-up and password reset are the only app routes that ask Supabase to send an email. When ticked, `age_confirmed_at` (ISO timestamp) is saved in the user's metadata. Log-in is unchanged; older accounts have no `age_confirmed_at`.
- Email links (sign-up confirmation and password reset): the templates in `emails/` link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (sign-up) or `...&type=recovery` (reset). `app/auth/confirm/route.ts` calls Supabase's `verifyOtp`, Supabase's recommended token-hash approach, so the link works in any browser, app or device and signs the user in there: sign-up goes to `/app`, reset goes to `/reset-password`. A used or expired sign-up link goes to `/login?link=expired` (a calm notice, not an error); a used or expired reset link goes to `/forgot-password?expired=1`. `app/auth/callback/route.ts` still handles older emails that used `{{ .ConfirmationURL }}` (code links that only work in the browser that asked): if the code fails in another browser, the user sees "Your email is confirmed. Please log in." The templates only take effect once pasted into Supabase (Authentication → Emails → Templates), and must be pasted after this code is on `main`, or confirmation links break. Supabase's Site URL must be `https://rehearse.livealign.co`.
- Password reset: `/login` has a "Forgot password?" link to `/forgot-password`, which always shows "If an account exists for that email, we've sent a link to reset your password." (only the rate limit gets its own message, the same friendly one as sign-up). `/reset-password` sets the new password (8+ characters, like sign-up), keeps the user logged in and goes to `/app`; without a valid link it says the link has expired and offers a new one. A one-hour `align_pw_reset` cookie (`lib/passwordReset.ts`), set by `/auth/confirm` after a valid reset link (and when a reset is requested, for older code links), is what lets `/reset-password` show its form. Buttons disable while sending (`components/PendingSubmit.tsx`).
- Setup screen: under the situation box, a muted line says what users share is encrypted and they can change names. No "don't share" warning.
- Legal pages: `/privacy`, `/terms` and `/disclaimer` render Markdown from `content/legal/*.md` through `components/LegalPage.tsx` (tables scroll sideways on a phone). The Privacy Policy and Terms of Service were replaced in full on 4 October 2026 with Krithika's text, word for word; edit wording only with her sign-off. `/disclaimer` was not changed.
- Cookie consent: `components/CookieBanner.tsx` + `lib/consent.ts` (localStorage, 365 days). Any analytics must check `hasAnalyticsConsent()` and listen for `CONSENT_EVENT` before loading. "Cookie preferences" in the footer reopens the banner. Every page shows `components/SiteFooter.tsx` (including `/login` and both `/signup` views), so the Privacy Policy's "at the bottom of every page" is true; add it to any new page.
- Auth emails (confirmation, password reset) come from Supabase via Resend SMTP as hello@livealign.co. Branded templates live in `emails/` and are pasted into Supabase by hand.
- The only app-sent email: Krithika's plain-text founding welcome (`lib/emails/founding-welcome.ts`), scheduled via Resend 3 days after a new founding perk is allocated in the Stripe webhook. `FOUNDING_EMAIL_DELAY_MINUTES` overrides the delay for testing.
- Rehearsal end signals (`lib/rehearsalSignals.ts`): how each rehearsal unfolds and ends, as labels and numbers only, never words. Columns on `conversations` (not encrypted, since they hold no content): `debrief_trigger` (`button`, `time_cue`, `user_asked`, `jordan`, `none`), `debrief_started_seconds` (from connect; empty with no debrief), `ended_by` (`jordan` = his end-call tool, `end_call_now`, `time_limit`, `connection_lost`, `unknown`), `user_turns_before_debrief`, `jordan_turns_before_debrief` (whole call if no debrief), `stuck_count`, `device_class` (`mobile`, `desktop`), `audio_prompt_shown`. The browser tracks them during the call (`AppClient.tsx`, via `signal(...)`) and sends them with the existing end-of-rehearsal save; `end-conversation` checks every field against the allowed values (`parseSignals`), writes them in a separate best-effort update for the session's user only, and never lets them stop the rehearsal saving. The database also rejects anything outside the allowed labels and ranges. **Detection depends on Jordan's exact phrases** in `JORDAN_PHRASES`: "stepping out of character" starts the debrief, "stepping out for a moment" is teaching mode. If his ElevenLabs prompt wording changes, change these too. "user_asked" means the user's last spoken turn before the debrief contained "wrap up" or "debrief". `ended_by` comes from the SDK's disconnect details (`endReasonFromDisconnect`): reason "agent" (Jordan's `end_call` tool event, or ElevenLabs closing the connection cleanly with code 1000) is `jordan`; ElevenLabs' own maximum-duration error is `unknown`; any other error or dropped connection is `connection_lost`; the app records `end_call_now` and `time_limit` itself before hanging up, and the first label wins. On real calls the `end_call` tool event most likely never reaches the browser (`agent_tool_response` is an ElevenLabs client event that is only sent if ticked on the agent), so Jordan's end shows up as the clean close: a real call on 9 October 2026 ended that way and was wrongly saved as `unknown` before `end-signal-fix`. The `?debug=1` log shows the raw disconnect details (`SDK: disconnected {...}`) and any tool or error events from ElevenLabs, to confirm on a real call. Phrase detection confirmed on a real call (9 October 2026); end detection tested against a fake ElevenLabs that ends calls both ways.
- `rehearsal_outcomes` captures "did you have the real conversation?" on the complete screen. Delayed follow-up is future work.

## Build philosophy

Ship fast, iterate fast. Simplest thing that works. No over-engineering. No premature abstractions. Don't build for hypothetical future requirements.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind configured; most styles live in `app/globals.css`
- **Database + auth:** Supabase (email/password auth, RLS on all tables), region West EU (Ireland), `eu-west-1`
- **Payments:** Stripe. Prices are looked up by lookup key (`align_monthly`, `align_annual`), never hard-coded price IDs. Test or live mode follows whichever `STRIPE_SECRET_KEY` is set; `.env.local.example` assumes test keys. Production runs in live mode (since 2 Oct 2026); Preview uses the Stripe sandbox.
- **Email:** Resend (SMTP for Supabase auth emails, API for the founding welcome)
- **Voice agent:** ElevenLabs Conversational AI, two Jordan agents. Browser SDK `@elevenlabs/client` 1.26.0 (was 1.7.0). Keep it at 1.8.1 or later: older versions drop Jordan's opening line on iPhone (Safari and in-app browsers like WhatsApp's), because iOS only lets sound start inside a tap and the player was created after several waits (mic check, server call, connection). Since 1.8.1 the SDK unlocks sound on the Start tap and primes the player ([elevenlabs/packages#777](https://github.com/elevenlabs/packages/issues/777)). That unlock only lasts 30 seconds, so `lib/audioOutput.ts` is a backstop: a second after connecting, if sound is still off, the call screen shows "Tap to hear Jordan". It reads the SDK's private player fields defensively, so recheck it after any SDK upgrade. On iPhone the SDK loads a resampler from cdn.jsdelivr.net; if a Content Security Policy is ever added, allow it. This fix did not work on a real iPhone (Safari, tested 4 October 2026), so the cause is still open. To find it, `/app?debug=1` shows an audio debug log (`lib/audioDebug.ts`, `components/DebugPanel.tsx`) with a "Copy log" button. It logs, in seconds since the Start tap: build (`NEXT_PUBLIC_BUILD_SHA`, set in `next.config.mjs` from Vercel's commit), SDK version, each start step, every audio context and state change, worklet and resampler loads, the hidden audio element's play() calls and state, each message from ElevenLabs as it arrives on the network versus when the SDK hands audio to the player, interruptions, mode changes, errors, and whether "Tap to hear Jordan" showed. Without `?debug=1` nothing is patched and nothing shows.
- **Microphone:** `lib/microphone.ts` + `components/MicPicker.tsx` (menu on the setup screen). The app picks one mic per rehearsal and pins every mic request to it: the user's saved choice (localStorage `align_mic`), else the browser default, never an iPhone/Continuity mic unless chosen. Without this, the SDK's "ideal" audio hints let Chrome pick a nearby iPhone.
- **Header and phone menu:** every page header uses `components/HeaderMenu.tsx` (marketing header on `/`, `/pricing`, `/account` and legal pages; app header on `/app`, the setup screen, `/rehearsals` and `/rehearsals/[id]`). Above 800px it shows the page's links in a row, plus "Log out" for signed-in users. At 800px and below the row becomes a three-line menu button; its panel lists: logged out, Pricing, Coaching, Sign in; logged in, Rehearse, Account, Coaching, Log out, plus Pricing on `/` for users without a running subscription, and Past rehearsals on `/app`. Link names: "Rehearse" goes to `/app` (start a rehearsal); "Past rehearsals" goes to `/rehearsals` (saved history). Renamed 5 October 2026 from "Your rehearsals" and "My rehearsals", which were too alike. It closes on a link tap, an outside tap, the button, or Escape. Log out (menu, header, and `/account`'s "Sign out") goes to the homepage; if Supabase can't be reached, the user stays signed in and sees a message. No menu on the call screen; `/login` and `/signup` have no header. Checked in a real browser at 320, 375, 390, 430, 820 and 1280px, logged out, free and paid: nothing wraps or runs off the screen.
- **Pricing on phones:** the two plan cards stack at 640px and below. Before 5 October 2026 they sat side by side on phones, squashed to about 150px each, because the phone rule came earlier in `globals.css` than the base rule. Phone rules must come after the base rules they override.
- **Analytics:** GA4 (`components/AnalyticsLoader.tsx`), loads only after cookie consent
- **Hosting:** Vercel, deployed from GitHub. Domain `livealign.co` (the app is at `rehearse.livealign.co`); Vercel URL `align-rehearsal-agent.vercel.app`.

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
9. `2026_10_09_rehearsal_end_signals.sql` (adds the rehearsal end-signal columns; only adds columns, safe to run twice)

Run on production on 2 Oct 2026: `founding_perk_booking`, `wipe_test_conversations`, `drop_plaintext_columns` (the plaintext columns no longer exist). Earlier ones are not recorded; check in Supabase before running anything.

The `founding_perks` table was emptied on production on 2 Oct 2026, so all 100 founding spots are open.

Tables: `profiles`, `conversations` (including the end-signal columns), `subscriptions`, `usage_counters`, `founding_perks`, `rehearsal_outcomes`.

## How to work with Krithika

1. **Always propose a plan before writing code.** List files you'll create, change, preserve.
2. **Wait for approval** before executing.
3. **Brief, concrete explanations.** Krithika is non-technical and learns by doing.
4. **Don't proactively start the next phase.** Stop when the current task is done.
5. **Cloud environment:** Krithika works in Claude Code's cloud, not locally. Push to a feature branch (not `main`) so Vercel auto-deploys a preview URL for review. Share the preview URL after each push. Merge to `main` only after explicit approval.

## What's done

- Launch v1 is on `main` (squash of `pricing-v2`, 2 Oct 2026): free + paid tiers, founding perk and welcome email, encryption at rest, outcome capture, cookie consent, branded Resend auth emails, GA4.
- `post-launch-fixes` merged to `main`: founding perk claimed only by a real Cal.com booking; `/account` shows a pending cancellation; friendly status labels.
- `resubscribe-fix` merged to `main`: cancelled customers can subscribe again; header link "About" renamed "Coaching" (still to https://livealign.co).
- Done on production, 2 Oct 2026: Stripe live mode on Production (Preview stays on the sandbox); Cal.com webhook set up, pointing at `rehearse.livealign.co/api/cal/webhook`.
- `mic-picker` merged to `main`: fixes the iPhone (Continuity) mic switching on; adds a microphone menu to the setup screen.
- `pricing-v2` and `stripe-integration` have no changes that are not already on `main`. Safe to delete.

- `signup-and-disclosures` merged to `main`: age confirmation at sign-up, 20-minute cap on `/pricing`, reassurance line on the setup screen.
- `signup-polish` merged to `main`: sign-up button disables while sending; friendly text for Supabase's email rate-limit message.
- `cap-copy` merged to `main`: 20-minute cap copy on both `/pricing` cards, below the cards, and on the setup screen; founding perk block centred with gold text.
- `legal-pages-update` merged to `main`: Privacy Policy and Terms of Service replaced on 4 October 2026; "Pro is subject to fair use" added under the `/pricing` cards; site footer added to `/login` and `/signup`.
- `mobile-fixes` merged to `main`: headers fit on one line on phones; SDK 1.26.0 plus the "Tap to hear Jordan" backstop, which did not fix the silent opening line on a real iPhone; `?debug=1` audio log on `/app` to find the real cause.
- `phone-menu` merged to `main`: phone menu and "Log out" in every header; log out goes to the homepage; pricing cards stack on phones.
- `password-reset` merged to `main`: "Forgot password?" flow; email links that work in any browser (`/auth/confirm`, new templates in `emails/`, to paste into Supabase after merging); links renamed "Rehearse" and "Past rehearsals".
- `rehearsal-end-signals` merged to `main`: records how each rehearsal ends, as labels and numbers (migration 9).
- Branch `end-signal-fix` (not yet on `main`): Jordan ending the call is recorded as `jordan` on real calls (clean server close); ElevenLabs' max-duration limit is `unknown`, not `connection_lost`; `?debug=1` shows raw disconnect details and tool events.

## Branches not on main

- `logo-swap`, `new-logo` (May 2026): early logo work, 30 commits behind. Probably stale.
- `setup-onboarding` (May 2026): welcome block on the rehearsal setup screen. Never merged.

## What's next / half-built

- Delayed outcome follow-up: columns exist in `rehearsal_outcomes`, nothing sends it (TODO in `2026_09_30_encryption_and_outcomes.sql`).
- Manual step after `password-reset` is merged: paste `emails/confirm-signup.html` and `emails/reset-password.html` into Supabase (Confirm signup and Reset Password templates).
