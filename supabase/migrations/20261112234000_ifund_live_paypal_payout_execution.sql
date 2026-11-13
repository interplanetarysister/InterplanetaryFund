-- End-to-end owner PayPal payout workflow.
-- Safety model:
-- - owner destination is bound only to the user's confirmed IFund account email after AAL2 + explicit attestation;
-- - PayPal remains responsible for recipient account onboarding/identity verification;
-- - payout execution is service-role only and requires a verified super-admin trigger;
-- - a withdrawal is never marked paid until PayPal reports SUCCESS for the exact item;
-- - UNCLAIMED/ONHOLD remain non-paid; terminal returned/failed/refunded states release the reservation.

create unique index if not exists ifund_connected_payout_account_owner_uid_uniq
  on ifund_finance.connected_payout_account(owner_auth_uid)
  where owner_auth_uid is not null;

alter table ifund_finance.withdrawal
  add column if not exists approved_by_auth_uid uuid references auth.users(id) on delete restrict,
  add column if not exists approved_at timestamptz,
  add column if not exists provider_payout_item_id text,
  add column if not exists provider_transaction_status text,
  add column if not exists provider_fee numeric,
  add column if not exists provider_last_verified_at timestamptz,
  add column if not exists provider_event_id text,
  add column if not exists provider_completed_at timestamptz,
  add column if not exists provider_error_code text;

create unique index if not exists ifund_withdrawal_provider_batch_uniq
  on ifund_finance.withdrawal(provider_sender_batch_id)
  where provider_sender_batch_id is not null;
create unique index if not exists ifund_withdrawal_provider_payout_item_uniq
  on ifund_finance.withdrawal(provider_payout_item_id)
  where provider_payout_item_id is not null;

create table if not exists ifund_finance.paypal_payout_events (
  paypal_event_id text primary key,
  withdrawal_id uuid not null references ifund_finance.withdrawal(id) on delete restrict,
  payout_batch_id text,
  payout_item_id text,
  transaction_status text not null,
  verified_at timestamptz not null default now()
);
alter table ifund_finance.paypal_payout_events enable row level security;
revoke all on ifund_finance.paypal_payout_events from public,anon,authenticated;
grant select,insert on ifund_finance.paypal_payout_events to service_role;

create or replace function public.ifund_owner_payout_destination()
returns table(
  provider text,
  recipient_email text,
  destination_status text,
  payouts_enabled boolean,
  details_submitted boolean,
  last_verified_at timestamptz
)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $fn$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  return query
  select a.provider,a.provider_account_id,a.status,
         coalesce(a.payouts_enabled,false),coalesce(a.details_submitted,false),a.last_verified_at
  from ifund_finance.connected_payout_account a
  where a.owner_auth_uid=auth.uid()
  limit 1;
end
$fn$;

create or replace function public.ifund_connect_paypal_payout_to_verified_email(p_attest boolean)
returns table(
  provider text,
  recipient_email text,
  destination_status text,
  payouts_enabled boolean,
  details_submitted boolean,
  last_verified_at timestamptz
)
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
declare
  v_uid uuid:=auth.uid();
  v_email text;
begin
  if v_uid is null or not public.ifund_current_account_is_active()
     or not ifund_private.withdrawal_mfa_ready() then
    raise exception 'Verified email and AAL2 MFA required' using errcode='42501';
  end if;
  if p_attest is distinct from true then
    raise exception 'Payout recipient attestation required' using errcode='22023';
  end if;
  select lower(btrim(u.email)) into v_email
  from auth.users u
  where u.id=v_uid and u.email_confirmed_at is not null
    and u.is_anonymous is false and u.email is not null;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Confirmed payout email required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.ifund_legal_acceptances l
    where l.owner_id=v_uid and l.explicit_consent is true
  ) then
    raise exception 'Current legal acceptance required before payouts' using errcode='42501';
  end if;

  insert into ifund_finance.connected_payout_account(
    owner_auth_uid,owner_user_id,provider,provider_account_id,status,
    charges_enabled,payouts_enabled,details_submitted,default_currency,
    last_verified_at,last_error
  ) values (
    v_uid,v_uid::text,'paypal_platform',v_email,'ready',
    false,true,true,'USD',now(),null
  )
  on conflict (owner_auth_uid) where owner_auth_uid is not null
  do update set
    owner_user_id=excluded.owner_user_id,
    provider='paypal_platform',
    provider_account_id=excluded.provider_account_id,
    status='ready',
    charges_enabled=false,
    payouts_enabled=true,
    details_submitted=true,
    default_currency='USD',
    last_verified_at=now(),
    last_error=null;

  return query select a.provider,a.provider_account_id,a.status,
    coalesce(a.payouts_enabled,false),coalesce(a.details_submitted,false),a.last_verified_at
  from ifund_finance.connected_payout_account a
  where a.owner_auth_uid=v_uid
  limit 1;
end
$fn$;

create or replace function public.ifund_disconnect_paypal_payout_destination()
returns boolean
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active()
     or not ifund_private.withdrawal_mfa_ready() then
    raise exception 'Verified email and AAL2 MFA required' using errcode='42501';
  end if;
  if exists (
    select 1 from ifund_finance.withdrawal w
    where w.owner_auth_uid=auth.uid()
      and w.status in ('pending','reserving','under_review','processing',
        'provider_status_unknown','reconciliation_pending','reservation_release_pending')
  ) then
    raise exception 'Active withdrawal must resolve before disconnecting payout destination'
      using errcode='P0001';
  end if;
  update ifund_finance.connected_payout_account
  set status='disabled',payouts_enabled=false,last_error='Disconnected by owner'
  where owner_auth_uid=auth.uid();
  return true;
end
$fn$;

create or replace function public.ifund_super_admin_payout_queue()
returns table(
  withdrawal_id uuid,
  campaign_id uuid,
  campaign_title text,
  owner_auth_uid uuid,
  gross_cents bigint,
  fee_cents bigint,
  net_cents bigint,
  request_status text,
  destination_ready boolean,
  provider_transaction_status text,
  requested_at timestamptz
)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $fn$
begin
  if auth.uid() is null or not coalesce(public.ifund_current_user_is_verified_super_admin(),false) then
    raise exception 'Verified super administrator only' using errcode='42501';
  end if;
  return query
  select w.id,w.campaign_id::uuid,c.title,w.owner_auth_uid,
    (w.gross_amount*100)::bigint,(w.platform_fee*100)::bigint,(w.net_amount*100)::bigint,
    w.status,
    coalesce(a.status='ready' and a.payouts_enabled is true and a.details_submitted is true
      and a.last_verified_at is not null,false),
    w.provider_transaction_status,w.migration_recorded_at
  from ifund_finance.withdrawal w
  join public.ifund_campaigns c on c.id=w.campaign_id::uuid
  left join ifund_finance.connected_payout_account a on a.owner_auth_uid=w.owner_auth_uid
  where w.status in ('under_review','processing','provider_status_unknown','reconciliation_pending')
  order by w.migration_recorded_at asc
  limit 500;
end
$fn$;

create or replace function public.ifund_internal_prepare_paypal_payout(
  p_withdrawal_id uuid,
  p_admin_user_id uuid
)
returns table(
  withdrawal_id uuid,
  receiver_email text,
  net_cents bigint,
  gross_cents bigint,
  fee_cents bigint,
  sender_batch_id text,
  sender_item_id text,
  payout_batch_id text,
  current_status text
)
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
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
  if w.platform_fee is null or w.platform_fee<>round(w.gross_amount*0.07,2)
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
$fn$;

create or replace function public.ifund_internal_record_payout_submission(
  p_withdrawal_id uuid,
  p_payout_batch_id text
)
returns boolean
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
declare w ifund_finance.withdrawal%rowtype;
begin
  if p_payout_batch_id is null or p_payout_batch_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'Invalid provider payout batch id' using errcode='22023';
  end if;
  select * into w from ifund_finance.withdrawal where id=p_withdrawal_id for update;
  if not found or w.status not in ('processing','provider_status_unknown') then
    raise exception 'Withdrawal is not awaiting provider submission' using errcode='P0001';
  end if;
  if w.payout_batch_id is not null and w.payout_batch_id<>p_payout_batch_id then
    raise exception 'Conflicting payout batch id' using errcode='23505';
  end if;
  update ifund_finance.withdrawal
    set payout_batch_id=p_payout_batch_id,status='processing',
        provider_transaction_status=coalesce(provider_transaction_status,'PENDING'),
        provider_last_verified_at=now(),provider_error_code=null
  where id=p_withdrawal_id;
  return true;
end
$fn$;

create or replace function public.ifund_internal_payout_lookup(p_withdrawal_id uuid)
returns table(
  withdrawal_id uuid,
  receiver_email text,
  net_cents bigint,
  gross_cents bigint,
  fee_cents bigint,
  sender_batch_id text,
  sender_item_id text,
  payout_batch_id text,
  payout_item_id text,
  current_status text,
  provider_transaction_status text
)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $fn$
begin
  return query
  select w.id,a.provider_account_id,(w.net_amount*100)::bigint,(w.gross_amount*100)::bigint,
    (w.platform_fee*100)::bigint,w.provider_sender_batch_id,w.id::text,w.payout_batch_id,
    w.provider_payout_item_id,w.status,w.provider_transaction_status
  from ifund_finance.withdrawal w
  join ifund_finance.connected_payout_account a on a.owner_auth_uid=w.owner_auth_uid
  where w.id=p_withdrawal_id and a.provider='paypal_platform'
  limit 1;
end
$fn$;

create or replace function public.ifund_internal_record_payout_state(
  p_withdrawal_id uuid,
  p_payout_batch_id text,
  p_payout_item_id text,
  p_transaction_status text,
  p_provider_fee_cents bigint default null,
  p_paypal_event_id text default null
)
returns boolean
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
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
      'Realized IFund 7% withdrawal fee',now()::text
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
$fn$;

revoke all on function public.ifund_owner_payout_destination() from public,anon;
revoke all on function public.ifund_connect_paypal_payout_to_verified_email(boolean) from public,anon;
revoke all on function public.ifund_disconnect_paypal_payout_destination() from public,anon;
revoke all on function public.ifund_super_admin_payout_queue() from public,anon;
grant execute on function public.ifund_owner_payout_destination() to authenticated;
grant execute on function public.ifund_connect_paypal_payout_to_verified_email(boolean) to authenticated;
grant execute on function public.ifund_disconnect_paypal_payout_destination() to authenticated;
grant execute on function public.ifund_super_admin_payout_queue() to authenticated;

revoke all on function public.ifund_internal_prepare_paypal_payout(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ifund_internal_record_payout_submission(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_internal_payout_lookup(uuid) from public,anon,authenticated;
revoke all on function public.ifund_internal_record_payout_state(uuid,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.ifund_internal_prepare_paypal_payout(uuid,uuid) to service_role;
grant execute on function public.ifund_internal_record_payout_submission(uuid,text) to service_role;
grant execute on function public.ifund_internal_payout_lookup(uuid) to service_role;
grant execute on function public.ifund_internal_record_payout_state(uuid,text,text,text,bigint,text) to service_role;
