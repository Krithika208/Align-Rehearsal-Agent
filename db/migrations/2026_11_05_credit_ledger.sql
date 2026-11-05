-- credits-stage-1: pay-as-you-go credits, and 3 free rehearsals instead of 5.
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- One row per change to a user's credits. Balance = sum(delta).
--   purchase  +1 or +5, one row per Stripe Checkout session (unique id below)
--   rehearsal -1 when a paid rehearsal starts
--   refund    +1 when that rehearsal ends in under 60 seconds, or fails to start
--   admin     any manual correction you make by hand
--
-- Users can read only their own rows. Only the server (service-role key)
-- writes, so nobody can give themselves credits from the browser.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The ledger
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('purchase', 'rehearsal', 'refund', 'admin')),
  stripe_checkout_session_id text unique,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_idx
  on public.credit_ledger (user_id);

-- At most one charge and one refund per rehearsal, so a repeated
-- end-of-call save never refunds twice.
create unique index if not exists credit_ledger_conversation_reason_idx
  on public.credit_ledger (conversation_id, reason)
  where conversation_id is not null;

alter table public.credit_ledger enable row level security;

drop policy if exists "credit_ledger_select_own" on public.credit_ledger;
create policy "credit_ledger_select_own"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Spend one credit, safely
-- ─────────────────────────────────────────────────────────────────────────────

-- Takes one credit if the balance is above zero and returns the new ledger
-- row's id, or null if there is nothing to spend. The lock makes two Starts
-- pressed at the same moment queue up, so one credit can't be spent twice.
create or replace function public.spend_credit(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  balance integer;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('credit_ledger:' || p_user_id::text));

  select coalesce(sum(delta), 0) into balance
  from public.credit_ledger where user_id = p_user_id;

  if balance <= 0 then
    return null;
  end if;

  insert into public.credit_ledger (user_id, delta, reason)
  values (p_user_id, -1, 'rehearsal')
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.spend_credit(uuid) from public, anon, authenticated;
grant execute on function public.spend_credit(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Free rehearsals: 3 lifetime (was 5)
-- ─────────────────────────────────────────────────────────────────────────────

-- Same as before, with the limit changed from 5 to 3. Once the user is at 3,
-- the row is left alone and the function returns 4 ("this one would be the
-- 4th") so the caller moves on to credits.
create or replace function public.increment_free_session_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.usage_counters as uc (user_id, free_sessions_used)
  values (p_user_id, 1)
  on conflict (user_id) do update
    set free_sessions_used = uc.free_sessions_used + 1,
        updated_at = now()
    where uc.free_sessions_used < 3
  returning uc.free_sessions_used into new_count;

  if new_count is null then
    select free_sessions_used + 1 into new_count
    from public.usage_counters where user_id = p_user_id;
  end if;

  return new_count;
end;
$$;

revoke execute on function public.increment_free_session_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_free_session_count(uuid) to service_role;
