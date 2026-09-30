-- Run ONLY after pricing-v2 is merged to main and the live site is running the
-- encrypting code. Until then the live site still writes plaintext into these
-- columns, and dropping them would break rehearsals there.
--
-- Removes the old plaintext columns so plaintext can never be written again.

alter table public.conversations
  drop column if exists transcript,
  drop column if exists situation;
