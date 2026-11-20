-- Additive reconciliation: the What-If verified-opportunity catalog grant
-- (20261120122219) references ifund_opportunity.requirements_complete and
-- deadline_at, and the What-If mission frontend selects both, but no
-- repository migration creates them. Add them additively before the grant
-- runs: requirements_complete defaults to false (incomplete) and deadline_at
-- is nullable until sources record deadlines.
begin;

alter table public.ifund_opportunity
  add column if not exists requirements_complete boolean not null default false,
  add column if not exists deadline_at timestamptz;

comment on column public.ifund_opportunity.requirements_complete is
  'True when the verified-source opportunity entry is complete; the What-If mission catalog grants select on it to authenticated.';

comment on column public.ifund_opportunity.deadline_at is
  'Deadline timestamp for verified-source opportunities; granted to authenticated by migration 20261120122219; null until sources record it.';

commit;
