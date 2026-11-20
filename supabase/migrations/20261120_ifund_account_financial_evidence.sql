-- Strictly read-only, super-admin only, partial financial evidence.
-- This report never authorizes account erasure or proves absence of funds.
-- Legacy identities, foreign provider receipts, pending transfers and disputes
-- require separate cross-system reconciliation.
create or replace function public.ifund_admin_account_financial_evidence(p_request_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_owner uuid;
 v_counts jsonb;
 v_found bigint;
begin
  if auth.uid() is null
    or not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
  then raise exception 'Verified super administrator required'
    using errcode='42501'; end if;
  if p_request_id is null then raise exception 'Request reference required'
    using errcode='22023'; end if;
  select r.user_id into v_owner
  from public.ifund_account_deletion_requests r
  where r.id=p_request_id
    and r.status in ('requested','reviewing','requires_legal_retention');
  if not found or v_owner is null then
    raise exception 'Open deletion request with an owner is required'
      using errcode='P0002';
  end if;

  -- Each count is a source-specific count, NOT a deduplicated total.
  select pg_catalog.jsonb_build_object(
    'canonical_donor_donations',
      (select count(*) from public.ifund_donations d where d.donor_id=v_owner),
    'canonical_donor_payment_intents',
      (select count(*) from public.ifund_payment_intents i where i.donor_id=v_owner),
    'canonical_member_subscription_intents',
      (select count(*) from public.ifund_subscription_intents i where i.member_id=v_owner),
    'canonical_member_subscription_ledger',
      (select count(*) from public.ifund_subscription_ledger l where l.member_id=v_owner),
    'canonical_owned_campaign_donations',
      (select count(*) from public.ifund_donations d
         join public.ifund_campaigns c on c.id=d.campaign_id
         where c.owner_id=v_owner),
    'canonical_owned_campaign_payment_intents',
      (select count(*) from public.ifund_payment_intents i
         join public.ifund_campaigns c on c.id=i.campaign_id
         where c.owner_id=v_owner),
    'canonical_owned_campaign_ledger_entries',
      (select count(*) from public.ifund_ledger_entries l
         join public.ifund_campaigns c on c.id=l.campaign_id
         where c.owner_id=v_owner),
    'migrated_donations',
      (select count(*) from ifund_finance.donation d where d.owner_auth_uid=v_owner),
    'migrated_withdrawals',
      (select count(*) from ifund_finance.withdrawal w where w.owner_auth_uid=v_owner),
    'migrated_holding_entries',
      (select count(*) from ifund_finance.holding_ledger_entry l where l.owner_auth_uid=v_owner),
    'migrated_financial_operations',
      (select count(*) from ifund_finance.financial_operation o where o.owner_auth_uid=v_owner),
    'migrated_subscription_intents',
      (select count(*) from ifund_finance.pay_pal_subscription_intent s where s.owner_auth_uid=v_owner)
  ) into v_counts;

  select sum(value::bigint) into v_found
  from pg_catalog.jsonb_each_text(v_counts);
  return pg_catalog.jsonb_build_object(
    'request_id',p_request_id,
    'source_counts',v_counts,
    'source_rows_found',coalesce(v_found,0),
    'possible_financial_history',coalesce(v_found,0)>0,
    'zero_activity_verified',false,
    'provider_reconciliation_complete',false,
    'legal_retention_resolved',false,
    'safe_to_erase',false,
    'evidence_limitations','Counts are overlapping and incomplete; unmatched legacy identities, external providers, refunds, chargebacks, pending payments and statutory retention still require independent verification.'
  );
end $fn$;
revoke all on function public.ifund_admin_account_financial_evidence(uuid)
  from public,anon,authenticated;
grant execute on function public.ifund_admin_account_financial_evidence(uuid)
  to authenticated;
comment on function public.ifund_admin_account_financial_evidence(uuid) is
 'Read-only financial trace counts for superadmins. Zero rows never proves no payments. No deletion authority.';
