-- iFund account closure / recovery retention state.
-- No existing accounts are deleted, disabled, or classified by this migration.
-- Never infer "no financial activity" from a missing/unavailable ledger query.
alter table public.ifund_account_deletion_requests
  add column if not exists account_disabled_at timestamptz,
  add column if not exists financial_retention_class text not null default 'unverified',
  add column if not exists financial_reviewed_at timestamptz,
  add column if not exists financial_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists financial_review_note text,
  add column if not exists recovery_expires_at timestamptz,
  add column if not exists hold_reason text;

do $guard$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ifund_account_deletion_requests'::regclass
      and conname = 'ifund_deletion_financial_retention_class_check'
  ) then
    alter table public.ifund_account_deletion_requests
      add constraint ifund_deletion_financial_retention_class_check
      check (financial_retention_class in
        ('unverified','no_financial_activity','financial_activity','financial_hold'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ifund_account_deletion_requests'::regclass
      and conname = 'ifund_deletion_recovery_window_check'
  ) then
    alter table public.ifund_account_deletion_requests
      add constraint ifund_deletion_recovery_window_check
      check (
        (recovery_expires_at is null)
        or (account_disabled_at is not null
            and financial_reviewed_at is not null
            and financial_retention_class in ('no_financial_activity','financial_activity')
            and recovery_expires_at >= account_disabled_at
            and recovery_expires_at >= financial_reviewed_at)
      );
  end if;
end $guard$;

-- Administrative preflight: read-only. This result is never approval to erase.
-- All financial classification evidence must be independently verified against
-- durable transactions, unsettled transfers, provider references and disputes.
create or replace function public.ifund_admin_account_recovery_policy(p_request_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $fn$
declare v record; v_earliest timestamptz;
begin
  if auth.uid() is null
    or not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
  then raise exception 'Verified super administrator required' using errcode='42501';
  end if;
  select id,status,requested_at,account_disabled_at,
    financial_retention_class,financial_reviewed_at,recovery_expires_at,
    hold_reason
  into v
  from public.ifund_account_deletion_requests where id=p_request_id;
  if not found then raise exception 'Deletion request not found' using errcode='P0002'; end if;
  if v.financial_retention_class in ('no_financial_activity','financial_activity')
      and v.account_disabled_at is not null and v.financial_reviewed_at is not null
  then
    v_earliest := greatest(
      v.account_disabled_at + case v.financial_retention_class
        when 'no_financial_activity' then interval '48 hours'
        else interval '30 days' end,
      v.financial_reviewed_at,
      v.recovery_expires_at
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'request_id',v.id,'request_status',v.status,
    'financial_retention_class',v.financial_retention_class,
    'recovery_earliest_at',v_earliest,
    'classification_verified', v.financial_reviewed_at is not null
      and v.financial_retention_class not in ('unverified','financial_hold'),
    'account_disabled',v.account_disabled_at is not null,
    'unresolved_hold',v.financial_retention_class='financial_hold'
      or v.hold_reason is not null,
    'safe_to_erase',false,
    'separate_legal_record_retention_required',true,
    'note','Read-only calculation. Identity deletion and financial retention require independently authorized execution.'
  );
end $fn$;
revoke all on function public.ifund_admin_account_recovery_policy(uuid)
  from public,anon,authenticated;
grant execute on function public.ifund_admin_account_recovery_policy(uuid)
  to authenticated;
comment on function public.ifund_admin_account_recovery_policy(uuid) is
 'Verified super-admin only, fail-closed read-only timing assessment. Never authorizes actual deletion.';
