-- How each rehearsal unfolds and ends, as fixed labels and numbers only.
-- These columns hold no words from the conversation, so they are not
-- encrypted. Written by app/api/elevenlabs/end-conversation (see
-- lib/rehearsalSignals.ts for the allowed values).
--
-- Only adds columns. Safe to run twice: every column uses "if not exists",
-- and existing rows and columns are untouched (new columns start empty).

alter table public.conversations
  add column if not exists debrief_trigger text
    check (debrief_trigger in ('button', 'time_cue', 'user_asked', 'jordan', 'none')),
  add column if not exists debrief_started_seconds integer
    check (debrief_started_seconds between 0 and 1800),
  add column if not exists ended_by text
    check (ended_by in ('jordan', 'end_call_now', 'time_limit', 'connection_lost', 'unknown')),
  add column if not exists user_turns_before_debrief integer
    check (user_turns_before_debrief between 0 and 1000),
  add column if not exists jordan_turns_before_debrief integer
    check (jordan_turns_before_debrief between 0 and 1000),
  add column if not exists stuck_count integer
    check (stuck_count between 0 and 1000),
  add column if not exists device_class text
    check (device_class in ('mobile', 'desktop')),
  add column if not exists audio_prompt_shown boolean;
