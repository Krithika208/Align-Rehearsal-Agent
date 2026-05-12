-- conversations table — full schema for the scenario picker / rehearsal flow.
-- Run this in the Supabase SQL editor. It is idempotent: existing columns and
-- policies are left alone; only what's missing gets created.

-- 1. Table (created if it doesn't already exist)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_slug text,
  relationship text,
  situation text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  el_conversation_id text,
  status text not null default 'in_progress',
  transcript jsonb,
  created_at timestamptz not null default now()
);

-- 2. Make sure each column exists (in case the table predates this migration)
alter table public.conversations
  add column if not exists scenario_slug text,
  add column if not exists relationship text,
  add column if not exists situation text,
  add column if not exists started_at timestamptz default now(),
  add column if not exists ended_at timestamptz,
  add column if not exists duration_seconds int,
  add column if not exists el_conversation_id text,
  add column if not exists status text default 'in_progress',
  add column if not exists transcript jsonb;

-- 3. Row Level Security — users may only see / write their own rows
alter table public.conversations enable row level security;

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
  on public.conversations for select
  using (auth.uid() = user_id);

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
  on public.conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
  on public.conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Helpful index for listing a user's rehearsals
create index if not exists conversations_user_id_started_at_idx
  on public.conversations (user_id, started_at desc);
