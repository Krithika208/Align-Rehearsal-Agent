-- Encrypted rehearsal content + rehearsal_outcomes. Additive and idempotent:
-- safe to run more than once, and safe to run before the app code deploys.
--
-- Encryption happens in the app (lib/encryption.ts) with ENCRYPTION_MASTER_KEY
-- from Vercel. The database only ever stores ciphertext, IVs and wrapped keys.
--
-- NOTE: ElevenLabs keeps its own copy of every conversation unless retention is
-- turned off. Disable data retention on BOTH Jordan agents (Male + Female) in
-- the ElevenLabs dashboard. Separate manual step, not done by this migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. conversations: encrypted transcript + situation
-- ─────────────────────────────────────────────────────────────────────────────
-- The old plaintext columns (transcript, situation) stay for now; the new code
-- never writes them. See 2026_09_30_drop_plaintext_columns.sql.

alter table public.conversations
  add column if not exists encrypted_content bytea,
  add column if not exists encryption_iv bytea,
  add column if not exists encrypted_key bytea,
  add column if not exists encrypted_situation bytea,
  add column if not exists situation_iv bytea,
  add column if not exists situation_key bytea;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. rehearsal_outcomes: did the user have the real conversation, how it went
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rehearsal_outcomes (
  id uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null unique references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  had_conversation boolean,
  how_it_went text check (how_it_went in ('better', 'same', 'worse')),
  answered_at timestamptz,
  -- TODO: delayed follow-up (future work). Needs a scheduled job or email
  -- service to send the reminder, set follow_up_sent_at, and collect answers
  -- via the service role.
  follow_up_sent_at timestamptz,
  follow_up_answered_at timestamptz,
  follow_up_had_conversation boolean,
  follow_up_how_it_went text check (follow_up_how_it_went in ('better', 'same', 'worse')),
  created_at timestamptz not null default now()
);

alter table public.rehearsal_outcomes enable row level security;

drop policy if exists "rehearsal_outcomes_select_own" on public.rehearsal_outcomes;
create policy "rehearsal_outcomes_select_own"
  on public.rehearsal_outcomes for select
  using (auth.uid() = user_id);

drop policy if exists "rehearsal_outcomes_update_own" on public.rehearsal_outcomes;
create policy "rehearsal_outcomes_update_own"
  on public.rehearsal_outcomes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Creates the empty outcome row for a rehearsal the caller owns. Idempotent:
-- returns the existing row's id if there already is one, null if the caller
-- doesn't own the rehearsal.
create or replace function public.create_rehearsal_outcome(p_rehearsal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  outcome_id uuid;
begin
  insert into public.rehearsal_outcomes (rehearsal_id, user_id)
  select c.id, c.user_id
  from public.conversations c
  where c.id = p_rehearsal_id and c.user_id = auth.uid()
  on conflict (rehearsal_id) do nothing;

  select id into outcome_id
  from public.rehearsal_outcomes
  where rehearsal_id = p_rehearsal_id and user_id = auth.uid();

  return outcome_id;
end;
$$;

revoke execute on function public.create_rehearsal_outcome(uuid) from public, anon;
grant execute on function public.create_rehearsal_outcome(uuid) to authenticated, service_role;
