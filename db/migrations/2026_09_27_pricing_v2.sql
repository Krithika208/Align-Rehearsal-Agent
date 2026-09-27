-- pricing-v2: one flat paid tier, a free tier, a fair-use cap and the founding perk.
-- Run this in the Supabase SQL editor. It is idempotent: safe to run more than once.
--
-- Counters and perks are written by the server only (service-role key). The RPCs
-- below are callable by the service role only, so a signed-in user can't bump
-- someone else's count or grab a perk slot from the browser.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. subscriptions: strip the founding/standard split
-- ─────────────────────────────────────────────────────────────────────────────

-- Old founding test rows become standard.
update public.subscriptions set tier = 'standard' where tier is distinct from 'standard';

-- Replace the tier check so 'standard' is the only allowed value.
alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions
  add constraint subscriptions_tier_check check (tier = 'standard');

-- The founding counter read founding_member; nothing calls it any more.
drop function if exists public.get_founding_count();
drop index if exists public.subscriptions_founding_member_idx;

alter table public.subscriptions
  drop column if exists founding_member,
  drop column if exists founding_locked_until,
  drop column if exists stripe_subscription_schedule_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. usage_counters: free lifetime count + paid monthly fair-use count
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.usage_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_sessions_used int not null default 0,
  paid_sessions_current_month int not null default 0,
  paid_sessions_month_start date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.usage_counters enable row level security;

drop policy if exists "usage_counters_select_own" on public.usage_counters;
create policy "usage_counters_select_own"
  on public.usage_counters for select
  using (auth.uid() = user_id);

-- Uses one free session. Never goes past 5: once the user is at 5, the row is
-- left alone and the function returns 6 ("this one would be the 6th") so the
-- caller can block.
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
    where uc.free_sessions_used < 5
  returning uc.free_sessions_used into new_count;

  if new_count is null then
    select free_sessions_used + 1 into new_count
    from public.usage_counters where user_id = p_user_id;
  end if;

  return new_count;
end;
$$;

-- Counts one paid session this month, resetting the count when a new month starts.
create or replace function public.increment_paid_session_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', now())::date;
  new_count integer;
begin
  insert into public.usage_counters as uc
    (user_id, paid_sessions_current_month, paid_sessions_month_start)
  values (p_user_id, 1, month_start)
  on conflict (user_id) do update
    set paid_sessions_current_month = case
          when uc.paid_sessions_month_start = month_start
            then uc.paid_sessions_current_month + 1
          else 1
        end,
        paid_sessions_month_start = month_start,
        updated_at = now()
  returning uc.paid_sessions_current_month into new_count;

  return new_count;
end;
$$;

revoke execute on function public.increment_free_session_count(uuid) from public, anon, authenticated;
revoke execute on function public.increment_paid_session_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_free_session_count(uuid) to service_role;
grant execute on function public.increment_paid_session_count(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. founding_perks: first 100 paid users get a 15-min call with Krithika
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.founding_perks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claim_position int not null unique check (claim_position between 1 and 100),
  claimed boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.founding_perks enable row level security;

drop policy if exists "founding_perks_select_own" on public.founding_perks;
create policy "founding_perks_select_own"
  on public.founding_perks for select
  using (auth.uid() = user_id);

-- Hands out the next slot, if any are left. The table lock makes two
-- simultaneous checkouts queue up instead of both grabbing the same position.
-- Calling it again for a user who already has a slot returns that slot, so a
-- retried Stripe webhook never allocates twice.
create or replace function public.allocate_founding_perk(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_position integer;
  max_position integer;
begin
  lock table public.founding_perks in share row exclusive mode;

  select claim_position into existing_position
  from public.founding_perks where user_id = p_user_id;
  if existing_position is not null then
    return jsonb_build_object('allocated', true, 'position', existing_position);
  end if;

  select coalesce(max(claim_position), 0) into max_position from public.founding_perks;
  if max_position >= 100 then
    return jsonb_build_object('allocated', false, 'position', null);
  end if;

  insert into public.founding_perks (user_id, claim_position)
  values (p_user_id, max_position + 1);

  return jsonb_build_object('allocated', true, 'position', max_position + 1);
end;
$$;

revoke execute on function public.allocate_founding_perk(uuid) from public, anon, authenticated;
grant execute on function public.allocate_founding_perk(uuid) to service_role;
