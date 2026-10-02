-- Add billing_interval to subscriptions.
-- Additive and idempotent: existing rows keep NULL (founding members are
-- monthly-only and stay NULL; standard members carry 'monthly' or 'annual').

alter table public.subscriptions
  add column if not exists billing_interval text;

-- Allow only the known values (NULL still permitted). Added separately and
-- guarded so re-running the migration doesn't error on an existing constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_billing_interval_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_interval_check
      check (billing_interval in ('monthly', 'annual'));
  end if;
end $$;
