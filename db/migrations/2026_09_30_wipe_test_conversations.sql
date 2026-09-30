-- ONE-OFF, DESTRUCTIVE. Pre-launch fresh start: deletes every rehearsal saved so
-- far (all test data, stored as plaintext). Run once, after
-- 2026_09_30_encryption_and_outcomes.sql. Cannot be undone.
--
-- Empties:
--   public.conversations       every row (scenario, relationship, situation,
--                               transcript, timings) for every user
--   public.rehearsal_outcomes  every row (removed automatically with its
--                               conversation; the table is new, so it's empty)
--
-- Leaves alone: users and logins, profiles, subscriptions, usage_counters
-- (free/paid session counts), founding_perks.

delete from public.conversations;
