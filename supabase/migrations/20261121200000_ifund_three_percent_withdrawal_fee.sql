-- Current IFund policy: campaign-owner withdrawals reserve a 3% fee on campaign gifts.
-- Optional supporter contributions are separate and are not reduced from donor gifts.
-- The recorded 700-bps rate is retained only for any historical withdrawal rows created
-- under the previous policy; all new reservations are explicitly recorded at 300 bps.

alter table ifund_finance.withdrawal
  add column if not exists platform_fee_bps smallint;

update ifund_finance.withdrawal
set platform_fee_bps = case
  when platform_fee = round(gross_amount * 0.03, 2) then 300
  when platform_fee = round(gross_amount * 0.07, 2) then 700
  else null
end
where platform_fee_bps is null;

do $guard$
begin
  if exists (
    select 1 from ifund_finance.withdrawal
    where platform_fee_bps is null
  ) then
    raise exception 'A withdrawal has an unrecognized fee amount; reconcile it before changing the fee policy';
  end if;
end;
$guard$;

alter table ifund_finance.withdrawal
  alter column platform_fee_bps set default 300,
  alter column platform_fee_bps set not null;

alter table ifund_finance.withdrawal
  drop constraint if exists withdrawal_seven_percent_fee;
alter table ifund_finance.withdrawal
  drop constraint if exists withdrawal_fee_rate_consistency;
alter table ifund_finance.withdrawal
  add constraint withdrawal_fee_rate_consistency check (
    gross_amount > 0
    and platform_fee is not null
    and platform_fee_bps in (300,700)
    and platform_fee = round(gross_amount * platform_fee_bps::numeric / 10000, 2)
    and net_amount = gross_amount - platform_fee
    and net_amount >= 0
  );

comment on column ifund_finance.withdrawal.platform_fee_bps is
  'Fee rate recorded when reserved. New campaign-owner withdrawals use 300 bps (3%); 700 bps is retained only for any historical rows.';

CREATE OR REPLACE FUNCTION public.ifund_my_campaign_financials()
 RETURNS TABLE(campaign_id uuid, campaign_title text, verified_donations bigint, verified_gifts_cents bigint, optional_support_cents bigint, estimated_platform_fee_cents bigint, estimated_owner_withdrawable_cents bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  return query
  select c.id,c.title,
    count(d.id)::bigint,
    coalesce(sum(d.gift_cents),0)::bigint,
    coalesce(sum(d.optional_support_cents),0)::bigint,
    round(coalesce(sum(d.gift_cents),0)::numeric*0.03)::bigint,
    (coalesce(sum(d.gift_cents),0)-round(coalesce(sum(d.gift_cents),0)::numeric*0.03))::bigint
  from public.ifund_campaigns c
  left join public.ifund_donations d on d.campaign_id=c.id and d.status='captured'
    and d.paypal_capture_id is not null and d.paypal_capture_verified_at is not null
  where c.owner_id=auth.uid()
  group by c.id,c.title order by c.title;
end $function$;


CREATE OR REPLACE FUNCTION public.ifund_request_withdrawal(p_campaign_id uuid, p_gross_cents bigint, p_request_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_owner uuid;
  v_existing ifund_finance.withdrawal%rowtype;
  v_cleared bigint:=0;
  v_paid bigint:=0;
  v_reserved bigint:=0;
  v_fee bigint;
  v_id uuid;
  v_hold_id uuid;
begin
  if v_user is null or not public.ifund_current_account_is_active()
     or not ifund_private.withdrawal_mfa_ready() then
    raise exception 'Verified email and AAL2 MFA required' using errcode='42501';
  end if;
  if not exists (
    select 1 from ifund_finance.connected_payout_account a
    where a.owner_auth_uid=v_user and a.provider='paypal_platform'
      and a.status='ready' and a.payouts_enabled is true
      and a.details_submitted is true and a.last_verified_at is not null
  ) then
    raise exception 'Verified PayPal payout destination required' using errcode='42501';
  end if;
  if p_gross_cents is null or p_gross_cents<1000 or p_gross_cents>100000000
     or p_request_key is null or p_request_key !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'Invalid withdrawal request' using errcode='22023';
  end if;

  select c.owner_id into v_owner from public.ifund_campaigns c
    where c.id=p_campaign_id for update;
  if v_owner is null or v_owner<>v_user then
    raise exception 'Campaign owner authorization required' using errcode='42501';
  end if;

  select * into v_existing from ifund_finance.withdrawal w
    where w.owner_auth_uid=v_user and w.canonical_operation_key=p_request_key;
  if found then
    if v_existing.campaign_id<>p_campaign_id::text
       or (v_existing.gross_amount*100)::bigint<>p_gross_cents then
      raise exception 'Withdrawal request key conflict' using errcode='23505';
    end if;
    if v_existing.canonical_reservation_id is null then
      raise exception 'Existing withdrawal lacks canonical reservation journal' using errcode='P0001';
    end if;
    return v_existing.id;
  end if;

  select coalesce(sum(greatest(0,pcc.cleared_campaign_cents-coalesce(d.campaign_refunded_cents,0))),0)::bigint
    into v_cleared
  from ifund_finance.paypal_cleared_captures pcc
  join public.ifund_donations d on d.id=pcc.donation_id
  join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
  where d.campaign_id=p_campaign_id and d.status in ('captured','refunded')
    and d.paypal_capture_id=pcc.paypal_capture_id and d.paypal_capture_verified_at is not null
    and pi.environment='live' and pi.status in ('captured','refunded')
    and pcc.currency='USD' and pcc.environment='live';

  select
    coalesce(sum((w.gross_amount*100)::bigint) filter(where w.status='paid'),0)::bigint,
    coalesce(sum((w.gross_amount*100)::bigint) filter(where w.status in
      ('pending','reserving','under_review','processing','provider_status_unknown',
       'reconciliation_pending','reservation_release_pending')),0)::bigint
  into v_paid,v_reserved
  from ifund_finance.withdrawal w where w.campaign_id=p_campaign_id::text;

  if v_cleared-v_paid-v_reserved < p_gross_cents then
    raise exception 'Provider-cleared available funds are insufficient' using errcode='P0001';
  end if;

  v_fee:=round(p_gross_cents::numeric*0.03)::bigint;
  insert into ifund_finance.withdrawal(
    owner_auth_uid,owner_user_id,campaign_id,gross_amount,platform_fee_bps,platform_fee,net_amount,
    status,canonical_operation_key,description
  ) values (
    v_user,v_user::text,p_campaign_id::text,p_gross_cents::numeric/100,
    300,v_fee::numeric/100,(p_gross_cents-v_fee)::numeric/100,
    'under_review',p_request_key,
    'Reserved from refund-adjusted provider-cleared campaign funds; payout not yet sent'
  ) returning id into v_id;

  insert into ifund_finance.holding_ledger_entry(
    owner_auth_uid,operation_key,direction,state,source_type,source_provider,
    campaign_id,beneficiary_user_id,amount,currency,platform_contribution,
    processing_fee,payment_channel,withdrawal_id,canonical_operation_id,reconciliation_note
  ) values (
    v_user,p_request_key||':reserve','reserve','reserved','withdrawal','paypal',
    p_campaign_id::text,v_user::text,p_gross_cents::numeric/100,'USD',
    v_fee::numeric/100,0,'paypal',v_id::text,p_request_key||':reserve',
    'Atomic owner withdrawal reservation; no provider payout sent'
  ) returning id into v_hold_id;

  update ifund_finance.withdrawal
    set canonical_reservation_id=v_hold_id::text,
        canonical_ledger_entry_id=v_hold_id::text,
        covered_holding_entry_ids=jsonb_build_array(v_hold_id::text)
    where id=v_id;
  return v_id;
end
$function$;


CREATE OR REPLACE FUNCTION public.ifund_internal_prepare_paypal_payout(p_withdrawal_id uuid, p_admin_user_id uuid)
 RETURNS TABLE(withdrawal_id uuid, receiver_email text, net_cents bigint, gross_cents bigint, fee_cents bigint, sender_batch_id text, sender_item_id text, payout_batch_id text, current_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  w ifund_finance.withdrawal%rowtype;
  a ifund_finance.connected_payout_account%rowtype;
  v_admin_ok boolean:=false;
  v_cleared bigint:=0;
  v_paid bigint:=0;
  v_reserved bigint:=0;
  v_sender text;
begin
  select exists(
    select 1 from auth.users u
    join public.ifund_profiles p on p.id=u.id
    where u.id=p_admin_user_id
      and u.email_confirmed_at is not null
      and coalesce(u.raw_app_meta_data->>'role','')='super_admin'
      and p.account_status='active'
      and p.account_deletion_pending is false
      and p.lifecycle_provenance in ('verified_source_owner_mapping','supabase_auth_signup')
  ) into v_admin_ok;
  if not v_admin_ok then
    raise exception 'Verified super administrator required' using errcode='42501';
  end if;

  select * into w from ifund_finance.withdrawal where id=p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal not found' using errcode='22023'; end if;
  if w.status='paid' then
    return query select w.id,null::text,(w.net_amount*100)::bigint,(w.gross_amount*100)::bigint,
      (w.platform_fee*100)::bigint,w.provider_sender_batch_id,w.id::text,w.payout_batch_id,w.status;
    return;
  end if;
  if w.status not in ('under_review','processing','provider_status_unknown') then
    raise exception 'Withdrawal is not payout eligible' using errcode='P0001';
  end if;
  if w.canonical_reservation_id is null then
    raise exception 'Canonical reservation journal missing' using errcode='P0001';
  end if;
  if w.platform_fee is null or w.platform_fee_bps not in (300,700)
     or w.platform_fee<>round(w.gross_amount*w.platform_fee_bps/10000,2)
     or w.net_amount<>w.gross_amount-w.platform_fee then
    raise exception 'Withdrawal fee invariant failed' using errcode='23514';
  end if;

  select * into a from ifund_finance.connected_payout_account
  where owner_auth_uid=w.owner_auth_uid
    and provider='paypal_platform'
    and status='ready'
    and payouts_enabled is true
    and details_submitted is true
    and last_verified_at is not null;
  if not found or a.provider_account_id is null then
    raise exception 'Verified PayPal payout destination required' using errcode='42501';
  end if;

  select coalesce(sum(greatest(0,pcc.cleared_campaign_cents-coalesce(d.campaign_refunded_cents,0))),0)::bigint
    into v_cleared
  from ifund_finance.paypal_cleared_captures pcc
  join public.ifund_donations d on d.id=pcc.donation_id
  join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
  where d.campaign_id=w.campaign_id::uuid
    and d.status in ('captured','refunded')
    and d.paypal_capture_id=pcc.paypal_capture_id
    and d.paypal_capture_verified_at is not null
    and pi.environment='live' and pi.status in ('captured','refunded')
    and pcc.currency='USD' and pcc.environment='live';

  select
    coalesce(sum((x.gross_amount*100)::bigint) filter(where x.status='paid'),0)::bigint,
    coalesce(sum((x.gross_amount*100)::bigint) filter(where x.status in
      ('pending','reserving','under_review','processing','provider_status_unknown',
       'reconciliation_pending','reservation_release_pending')),0)::bigint
  into v_paid,v_reserved
  from ifund_finance.withdrawal x where x.campaign_id=w.campaign_id;

  if v_cleared < v_paid+v_reserved then
    update ifund_finance.withdrawal
      set status='reconciliation_pending',provider_error_code='REFUND_OR_SETTLEMENT_RECONCILIATION_REQUIRED'
      where id=w.id;
    raise exception 'Refund-adjusted settled funds no longer cover reservations' using errcode='P0001';
  end if;

  v_sender:=coalesce(w.provider_sender_batch_id,'ifund-'||replace(w.id::text,'-',''));
  update ifund_finance.withdrawal
    set status='processing',
        approved_by_auth_uid=coalesce(approved_by_auth_uid,p_admin_user_id),
        approved_at=coalesce(approved_at,now()),
        provider_sender_batch_id=v_sender,
        provider_error_code=null
    where id=w.id
    returning * into w;

  return query select w.id,a.provider_account_id,(w.net_amount*100)::bigint,
    (w.gross_amount*100)::bigint,(w.platform_fee*100)::bigint,
    v_sender,w.id::text,w.payout_batch_id,w.status;
end
$function$;


CREATE OR REPLACE FUNCTION public.ifund_internal_record_payout_state(p_withdrawal_id uuid, p_payout_batch_id text, p_payout_item_id text, p_transaction_status text, p_provider_fee_cents bigint DEFAULT NULL::bigint, p_paypal_event_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  w ifund_finance.withdrawal%rowtype;
  v_event ifund_finance.paypal_payout_events%rowtype;
  v_release_id uuid;
begin
  if p_transaction_status not in ('SUCCESS','FAILED','PENDING','UNCLAIMED','RETURNED','ONHOLD','BLOCKED','REFUNDED','CANCELED','DENIED') then
    raise exception 'Unsupported payout status' using errcode='22023';
  end if;
  if p_payout_batch_id is null or p_payout_batch_id !~ '^[A-Za-z0-9_-]{8,64}$'
     or p_payout_item_id is null or p_payout_item_id !~ '^[A-Za-z0-9_-]{8,128}$'
     or p_provider_fee_cents is not null and p_provider_fee_cents<0 then
    raise exception 'Malformed provider payout evidence' using errcode='22023';
  end if;
  select * into w from ifund_finance.withdrawal where id=p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal not found' using errcode='22023'; end if;
  if w.provider_sender_batch_id is null then
    raise exception 'Payout sender identity missing' using errcode='P0001';
  end if;
  if w.payout_batch_id is not null and w.payout_batch_id<>p_payout_batch_id then
    raise exception 'Payout batch identity conflict' using errcode='23505';
  end if;
  if w.provider_payout_item_id is not null and w.provider_payout_item_id<>p_payout_item_id then
    raise exception 'Payout item identity conflict' using errcode='23505';
  end if;

  if p_paypal_event_id is not null then
    select * into v_event from ifund_finance.paypal_payout_events
      where paypal_event_id=p_paypal_event_id;
    if found then
      if v_event.withdrawal_id<>p_withdrawal_id
        or coalesce(v_event.payout_batch_id,'')<>coalesce(p_payout_batch_id,'')
        or coalesce(v_event.payout_item_id,'')<>coalesce(p_payout_item_id,'')
        or v_event.transaction_status<>p_transaction_status then
        raise exception 'Payout event identity conflict' using errcode='23505';
      end if;
      return true;
    end if;
    insert into ifund_finance.paypal_payout_events(
      paypal_event_id,withdrawal_id,payout_batch_id,payout_item_id,transaction_status
    ) values (
      p_paypal_event_id,p_withdrawal_id,p_payout_batch_id,p_payout_item_id,p_transaction_status
    );
  end if;

  update ifund_finance.withdrawal
    set payout_batch_id=p_payout_batch_id,
        provider_payout_item_id=p_payout_item_id,
        provider_transaction_status=p_transaction_status,
        provider_fee=case when p_provider_fee_cents is null then provider_fee else p_provider_fee_cents::numeric/100 end,
        provider_last_verified_at=now(),
        provider_event_id=coalesce(p_paypal_event_id,provider_event_id)
  where id=p_withdrawal_id
  returning * into w;

  if p_transaction_status='SUCCESS' then
    insert into ifund_finance.holding_ledger_entry(
      owner_auth_uid,operation_key,direction,state,source_type,source_provider,
      provider_transaction_id,campaign_id,beneficiary_user_id,amount,currency,
      platform_contribution,processing_fee,payment_channel,withdrawal_id,
      canonical_operation_id,reconciliation_note,settled_at
    ) values (
      w.owner_auth_uid,w.canonical_operation_key||':payout','out','paid','withdrawal','paypal',
      p_payout_item_id,w.campaign_id,w.owner_user_id,w.net_amount,'USD',
      0,coalesce(p_provider_fee_cents,0)::numeric/100,'paypal',w.id::text,
      w.canonical_operation_key||':payout','Provider-confirmed PayPal payout',now()::text
    )
    on conflict (operation_key) do nothing;

    insert into ifund_finance.holding_ledger_entry(
      owner_auth_uid,operation_key,direction,state,source_type,source_provider,
      campaign_id,beneficiary_user_id,amount,currency,platform_contribution,
      processing_fee,payment_channel,withdrawal_id,canonical_operation_id,
      reconciliation_note,settled_at
    ) values (
      w.owner_auth_uid,w.canonical_operation_key||':fee','fee','paid','withdrawal','paypal',
      w.campaign_id,w.owner_user_id,w.platform_fee,'USD',w.platform_fee,
      0,'paypal',w.id::text,w.canonical_operation_key||':fee',
      format('Realized IFund %s%% withdrawal fee',w.platform_fee_bps/100),now()::text
    )
    on conflict (operation_key) do nothing;

    update ifund_finance.holding_ledger_entry
      set state='paid',settled_at=coalesce(settled_at,now()::text)
      where id::text=w.canonical_reservation_id;

    update ifund_finance.withdrawal
      set status='paid',processed_at=coalesce(processed_at,now()),
          provider_completed_at=coalesce(provider_completed_at,now()),provider_error_code=null
      where id=w.id;
    return true;
  end if;

  if p_transaction_status in ('FAILED','RETURNED','BLOCKED','REFUNDED','CANCELED','DENIED') then
    insert into ifund_finance.holding_ledger_entry(
      owner_auth_uid,operation_key,direction,state,source_type,source_provider,
      provider_transaction_id,campaign_id,beneficiary_user_id,amount,currency,
      platform_contribution,processing_fee,payment_channel,withdrawal_id,
      canonical_operation_id,reconciliation_note,settled_at
    ) values (
      w.owner_auth_uid,w.canonical_operation_key||':release','release','released','withdrawal','paypal',
      p_payout_item_id,w.campaign_id,w.owner_user_id,w.gross_amount,'USD',
      w.platform_fee,0,'paypal',w.id::text,w.canonical_operation_key||':release',
      'Provider payout did not settle; reservation released',now()::text
    )
    on conflict (operation_key) do nothing;

    update ifund_finance.holding_ledger_entry
      set state='released',settled_at=coalesce(settled_at,now()::text)
      where id::text=w.canonical_reservation_id;
    update ifund_finance.holding_ledger_entry
      set state='reversed'
      where withdrawal_id=w.id::text and direction in ('out','fee') and state='paid';

    update ifund_finance.withdrawal
      set status=case when p_transaction_status='CANCELED' then 'cancelled' else 'failed' end,
          provider_completed_at=now(),
          processed_at=null,
          provider_error_code=p_transaction_status
      where id=w.id;
    return true;
  end if;

  update ifund_finance.withdrawal
    set status=case when p_transaction_status='PENDING' then 'processing' else 'reconciliation_pending' end,
        provider_error_code=case when p_transaction_status in ('UNCLAIMED','ONHOLD') then p_transaction_status else null end
    where id=w.id;
  return true;
end
$function$;

