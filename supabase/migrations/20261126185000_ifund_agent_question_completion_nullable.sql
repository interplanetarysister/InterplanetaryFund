-- iFund platform-wide agent chat completion repair.
-- Confirmed live failure: ifund_complete_agent_question() sets reservation_expires_at
-- to NULL, but its table column was NOT NULL. The existing status CHECK explicitly
-- REQUIRES NULL expiry for completed questions, so the column constraint prevented
-- all completed agent replies, regardless of tier.
-- Applied to production project ssibsfmtodgximseeqsv on 2026-11-26.
alter table public.ifund_agent_question_usage
  alter column reservation_expires_at drop not null;

comment on column public.ifund_agent_question_usage.reservation_expires_at
  is 'Reserved questions have an expiry; completed questions must clear expiry and set completed_at.';

-- Integrity is already enforced by existing
-- ifund_agent_question_usage_completion_check:
-- reserved => completed_at NULL and expiry NOT NULL;
-- completed => completed_at NOT NULL and expiry NULL.
-- No client table grants or RLS policies change in this migration.
