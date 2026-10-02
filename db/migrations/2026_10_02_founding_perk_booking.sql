-- Founding perk: claimed only on a real Cal.com booking, not on a link click.
-- Run ONCE in the Supabase SQL editor, after 2026_09_27_pricing_v2.sql and
-- before setting up the Cal.com webhook. Steps 1 and 2 are safe to re-run.
-- Step 3 resets every claim, so re-running it later would wipe real bookings.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. booking_ref: opaque ID added to the booking link as metadata[perk_ref].
--    Cal.com sends it back in the webhook, so the email never goes in the URL.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.founding_perks
  add column if not exists booking_ref uuid not null default gen_random_uuid();

create unique index if not exists founding_perks_booking_ref_key
  on public.founding_perks (booking_ref);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fallback match on the attendee's email (the founding welcome email holds
--    the plain link, with no booking_ref). Service role only.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.find_founding_perk_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select fp.user_id
  from public.founding_perks fp
  join auth.users u on u.id = fp.user_id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke execute on function public.find_founding_perk_by_email(text) from public, anon, authenticated;
grant execute on function public.find_founding_perk_by_email(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Reset every claim so far. All of them came from a link click.
-- ─────────────────────────────────────────────────────────────────────────────

update public.founding_perks set claimed = false, claimed_at = null where claimed;
