-- subscriptions table — one row per paying user, mirrors Stripe subscription state.
-- Run this in the Supabase SQL editor. It is idempotent.
--
-- Writes happen server-side only (service-role key, in the Stripe webhook).
-- RLS lets a user read their own row; there are no public write policies.

-- 1. Table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_subscription_schedule_id text,
  tier text not null check (tier in ('founding', 'standard')),
  status text not null,
  founding_member boolean not null default false,
  founding_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Make sure each column exists (in case the table predates this migration)
alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_schedule_id text,
  add column if not exists tier text,
  add column if not exists status text,
  add column if not exists founding_member boolean default false,
  add column if not exists founding_locked_until timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 3. Row Level Security — a user may read only their own subscription.
--    No insert/update/delete policies → those are blocked for anon/authenticated
--    clients and only the service role (which bypasses RLS) can write.
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- 4. Helpful indexes for webhook lookups
create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

create index if not exists subscriptions_founding_member_idx
  on public.subscriptions (founding_member);

-- 5. Atomic founding-member counter.
--    SECURITY DEFINER so it can count across all rows regardless of RLS, and so
--    the checkout route (anon/authenticated client) can call it. It returns only
--    an integer — no row data leaks.
create or replace function public.get_founding_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.subscriptions where founding_member = true;
$$;

grant execute on function public.get_founding_count() to anon, authenticated, service_role;
