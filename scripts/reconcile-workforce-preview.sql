-- Operator-only reconciliation of the existing isolated preview.
-- This is not a migration or an application endpoint. Run only after reviewing
-- the deployed preview Worker, private bindings and current Workers Free plan.
-- No inference or queued task is dispatched by this operation.
begin;

do $preview$
declare
  policy ifund_ops.workforce_control%rowtype;
begin
  select * into policy from ifund_ops.workforce_control
    where singleton for update;
  if not found then raise exception 'Workforce control is missing'; end if;
  if policy.enabled then
    raise exception 'Production control changed; stop and reconcile';
  end if;
  if policy.free_plan_verified_until is null
    or policy.free_plan_verified_until <= now()
    or coalesce(length(policy.free_plan_evidence), 0) = 0
    or policy.daily_limit_units > 8000
    or policy.critical_reserve_units < 1000
    or policy.max_requests_per_day > 2 then
    raise exception 'Current verified free capacity is required';
  end if;
  if policy.worker_secret_sha256 is null
    or policy.preview_worker_secret_sha256 is null
    or policy.worker_secret_sha256 = policy.preview_worker_secret_sha256 then
    raise exception 'Distinct private executor channels are required';
  end if;
  if not exists(select 1 from ifund_story_runtime.control where singleton)
    or exists(select 1 from ifund_story_runtime.control where enabled) then
    raise exception 'Shared writing control changed; stop and reconcile';
  end if;
  if to_regprocedure('ifund_workforce_runtime.story_preview_enabled()') is null
    or not exists(select 1 from pg_proc p
      where p.oid='ifund_story_runtime.require_member()'::regprocedure
        and p.prosrc like '%ifund_workforce_runtime.story_preview_enabled()%') then
    raise exception 'The reviewed isolated writing access migration is required';
  end if;
  if not exists(
    select 1 from ifund_ops.workforce_implementations i
    where i.id = 'cloudflare_story_llama33_v1'
      and i.provider = 'cloudflare' and i.adapter = 'workers_ai'
      and i.model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      and ifund_workforce_runtime.eligible(i, 'story.draft.v1')
      and ifund_workforce_runtime.eligible(i, 'story.section.v1')
  ) then
    raise exception 'The exact tested zero-cost writing implementation is required';
  end if;
  -- Only this flag changes. Production, quota, evidence, keys, permissions,
  -- implementation descriptors and all existing user records are retained.
  update ifund_ops.workforce_control set preview_enabled = true
    where singleton and enabled = false;
end
$preview$;

select enabled as production_enabled, preview_enabled,
  free_plan_verified_until, daily_limit_units, critical_reserve_units,
  max_requests_per_day
from ifund_ops.workforce_control where singleton;
commit;

-- If preview must be suspended again, use a separate reviewed operation:
-- update ifund_ops.workforce_control set preview_enabled = false where singleton;
-- Never enable production as a fallback for a failed preview test.
