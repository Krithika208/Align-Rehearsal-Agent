-- sensitive-consent: when the user agreed to Align's AI using and saving any
-- sensitive information they share. Empty (null) means not yet agreed: /app
-- shows the consent screen and rehearsals can't start.
-- Run this in the Supabase SQL editor. Safe to run more than once.
-- Nobody is backfilled: existing users see the screen once on their next visit.

alter table public.usage_counters
  add column if not exists sensitive_consent_at timestamptz;

-- Records consent once. Creates the user's usage_counters row if they don't
-- have one yet, and never overwrites a date that is already set.
create or replace function public.record_sensitive_consent(p_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  consented timestamptz;
begin
  insert into public.usage_counters as uc (user_id, sensitive_consent_at)
  values (p_user_id, now())
  on conflict (user_id) do update
    set sensitive_consent_at = coalesce(uc.sensitive_consent_at, now()),
        updated_at = now()
  returning uc.sensitive_consent_at into consented;
  return consented;
end;
$$;

revoke execute on function public.record_sensitive_consent(uuid) from public, anon, authenticated;
grant execute on function public.record_sensitive_consent(uuid) to service_role;
