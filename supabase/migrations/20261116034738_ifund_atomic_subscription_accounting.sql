-- SOURCE ONLY: additive; requires independent catalog/provider acceptance before application.
-- Hosted catalog inspected 2026-11-16: no subscription intents or ledger rows and no atomic RPC.
-- Preserve every historical row; never infer a provider resource or refund parent from timestamps.
create schema if not exists ifund_subscription_runtime;
revoke all on schema ifund_subscription_runtime from public,anon,authenticated;
grant usage on schema ifund_subscription_runtime to service_role;
create table if not exists ifund_subscription_runtime.control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  contract_version integer not null default 1 check(contract_version=1),
  verified_merchant_id text,
  check(not enabled or (verified_merchant_id is not null and verified_merchant_id ~ '^[A-Za-z0-9_-]{8,100}$'))
);
alter table ifund_subscription_runtime.control enable row level security;
revoke all on ifund_subscription_runtime.control from public,anon,authenticated,service_role;
grant select on ifund_subscription_runtime.control to service_role;
insert into ifund_subscription_runtime.control(singleton) values(true) on conflict do nothing;

alter table public.ifund_subscription_ledger
  add column if not exists provider_resource_id text,
  add column if not exists parent_provider_resource_id text,
  add column if not exists provider_merchant_id text;
alter table public.ifund_subscription_events add column if not exists verified_fingerprint jsonb;
alter table public.ifund_subscription_intents
  add column if not exists last_provider_status_at timestamptz,
  add column if not exists last_provider_status text,
  add column if not exists last_state_event_at timestamptz,
  add column if not exists last_state_event_rank smallint not null default 0 check(last_state_event_rank between 0 and 3);
-- NULL historical identities remain NULL until separately reconciled against real receipts.
create unique index ifund_subscription_economic_resource_unique
  on public.ifund_subscription_ledger(environment,entry_type,provider_resource_id)
  where provider_resource_id is not null;
create index ifund_subscription_refund_parent_idx
  on public.ifund_subscription_ledger(intent_id,parent_provider_resource_id)
  where parent_provider_resource_id is not null;

create or replace function public.ifund_subscription_atomic_readiness()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  select jsonb_build_object('version',contract_version,'enabled',enabled,'merchant_id',verified_merchant_id)
    into result from ifund_subscription_runtime.control where singleton;
  return coalesce(result,'{"version":1,"enabled":false}'::jsonb);
end $$;
revoke all on function public.ifund_subscription_atomic_readiness() from public,anon,authenticated;
grant execute on function public.ifund_subscription_atomic_readiness() to service_role;

create or replace function public.ifund_apply_verified_subscription_event(p_event jsonb)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare
  v_intent public.ifund_subscription_intents%rowtype;
  v_existing public.ifund_subscription_ledger%rowtype;
  v_parent public.ifund_subscription_ledger%rowtype;
  v_event public.ifund_subscription_events%rowtype;
  v_kind text := p_event->>'kind';
  v_resource text := p_event->>'resource_id';
  v_parent_id text := p_event->>'parent_resource_id';
  v_event_id text := p_event->>'event_id';
  v_merchant text := p_event->>'merchant_id';
  v_provider_status text := p_event->>'provider_status';
  v_event_type text;
  v_effective_status text;
  v_effective_status_at timestamptz;
  v_provider_rank smallint;
  v_existing_provider_rank smallint;
  v_amount bigint;
  v_at timestamptz := (p_event->>'occurred_at')::timestamptz;
  v_status_at timestamptz := (p_event->>'status_at')::timestamptz;
  v_state_at timestamptz;
  v_floor timestamptz;
  v_rank smallint;
  v_status text;
  v_key text;
  v_legacy_key text;
  v_count bigint;
  v_duplicate boolean := false;
  v_fingerprint jsonb;
  v_prior_fingerprint jsonb;
  v_applied boolean := false;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if not exists(select 1 from ifund_subscription_runtime.control where singleton and enabled
      and contract_version=1 and verified_merchant_id=v_merchant) then
    raise exception 'atomic subscription accounting not ready' using errcode='55000';
  end if;
  if jsonb_typeof(p_event)<>'object' or v_kind is null or v_kind not in('payment','refund','status')
    or p_event->>'environment' is distinct from 'live' or p_event->>'currency' is distinct from 'USD'
    or v_provider_status is null or v_provider_status not in('ACTIVE','APPROVAL_PENDING','SUSPENDED','CANCELLED','EXPIRED')
    or v_status_at is null or v_status_at>now()+interval '5 minutes'
    or (p_event->>'subscription_id') !~ '^I-[A-Z0-9]{10,30}$'
    or nullif(p_event->>'custom_id','') is null then
    raise exception 'invalid verified subscription event' using errcode='22023';
  end if;
  select * into v_intent from public.ifund_subscription_intents
    where id=(p_event->>'intent_id')::uuid for update;
  if not found or v_intent.member_id is distinct from (p_event->>'member_id')::uuid
    or v_intent.paypal_subscription_id is distinct from p_event->>'subscription_id'
    or v_intent.paypal_plan_id is distinct from p_event->>'plan_id'
    or v_intent.custom_id is distinct from p_event->>'custom_id'
    or v_intent.currency is distinct from 'USD' then
    raise exception 'subscription owner or provider identity mismatch' using errcode='22023';
  end if;
  -- Provider status has its own clock: a late payment must never revive a
  -- canceled subscription using an older ACTIVE provider snapshot.
  if v_intent.last_provider_status_at is null and v_intent.status='canceled'
    and v_provider_status not in('CANCELLED','EXPIRED') then
    raise exception 'historical cancellation provenance reconciliation required' using errcode='55000';
  end if;
  v_provider_rank:=case when v_provider_status in('CANCELLED','EXPIRED') then 3 when v_provider_status='SUSPENDED' then 2 when v_provider_status='ACTIVE' then 1 else 0 end;
  v_existing_provider_rank:=case when v_intent.last_provider_status in('CANCELLED','EXPIRED') then 3 when v_intent.last_provider_status='SUSPENDED' then 2 when v_intent.last_provider_status='ACTIVE' then 1 else 0 end;
  if v_intent.last_provider_status_at is not null and
    (v_intent.last_provider_status_at,v_existing_provider_rank)>=(v_status_at,v_provider_rank) then
    v_effective_status:=v_intent.last_provider_status;
    v_effective_status_at:=v_intent.last_provider_status_at;
  else
    v_effective_status:=v_provider_status;
    v_effective_status_at:=v_status_at;
  end if;
  if v_kind<>'status' then
    if v_resource is null or v_resource !~ '^[A-Za-z0-9_-]{8,100}$' or v_resource like 'WH-%'
      or v_event_id is null or v_event_id !~ '^WH-[A-Z0-9-]{8,90}$'
      or v_at is null or v_at<v_intent.created_at or v_at>now()+interval '5 minutes'
      or (p_event->>'amount_cents') is null or (p_event->>'amount_cents') !~ '^[1-9][0-9]{0,8}$' then
      raise exception 'invalid verified economic resource' using errcode='22023';
    end if;
    v_amount:=(p_event->>'amount_cents')::bigint;
    if v_amount>100000000 or (v_kind='payment' and v_amount<>v_intent.amount_cents) then
      raise exception 'subscription amount mismatch' using errcode='22023';
    end if;
    v_event_type:=case when v_kind='payment' then 'PAYMENT.SALE.COMPLETED' else 'PAYMENT.SALE.REFUNDED' end;
    if v_kind='refund' and (v_parent_id is null or v_parent_id !~ '^[A-Za-z0-9_-]{8,100}$' or v_parent_id=v_resource) then
      raise exception 'verified parent sale required' using errcode='22023';
    end if;
    if v_kind='payment' and v_parent_id is not null then
      raise exception 'unexpected payment parent' using errcode='22023';
    end if;
    v_fingerprint:=jsonb_build_object('kind',v_kind,'resource',v_resource,'parent',v_parent_id,
      'intent',v_intent.id,'member',v_intent.member_id,'subscription',v_intent.paypal_subscription_id,
      'amount',v_amount,'currency','USD','environment','live','merchant',v_merchant,'at',v_at);
    select * into v_event from public.ifund_subscription_events where paypal_event_id=v_event_id;
    if found and (v_event.paypal_subscription_id is distinct from v_intent.paypal_subscription_id
      or v_event.event_type is distinct from v_event_type or v_event.verified_fingerprint is distinct from v_fingerprint) then
      raise exception 'provider event identity conflict or historical evidence incomplete' using errcode='23505';
    end if;
    -- Compatibility lookup includes the historical timestamp key, but an old row
    -- without an immutable receipt reference is rejected, never silently upgraded.
    v_legacy_key:=case when v_kind='payment' then 'paypal:subscription:payment:'||v_intent.paypal_subscription_id||':'||
      to_char(v_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') else 'paypal:subscription:reversal:'||v_event_id end;
    select count(*) into v_count from public.ifund_subscription_ledger
      where (provider_resource_id=v_resource and entry_type=v_kind and environment='live')
        or (provider_reference=v_resource and entry_type=v_kind and environment='live')
        or operation_key=v_legacy_key;
    if v_count>1 then raise exception 'ambiguous historical economic resource' using errcode='23505'; end if;
    if v_count=1 then
      select * into v_existing from public.ifund_subscription_ledger
        where (provider_resource_id=v_resource and entry_type=v_kind and environment='live')
          or (provider_reference=v_resource and entry_type=v_kind and environment='live') or operation_key=v_legacy_key;
      if v_existing.intent_id is distinct from v_intent.id or v_existing.member_id is distinct from v_intent.member_id
        or v_existing.paypal_subscription_id is distinct from v_intent.paypal_subscription_id
        or v_existing.provider_reference is distinct from v_resource or v_existing.entry_type is distinct from v_kind
        or v_existing.amount_cents is distinct from (case when v_kind='payment' then v_amount else -v_amount end)
        or v_existing.currency is distinct from 'USD' or v_existing.environment is distinct from 'live'
        or v_existing.provider_occurred_at is distinct from v_at
        or (v_existing.provider_resource_id is not null and v_existing.provider_resource_id<>v_resource)
        or (v_existing.provider_merchant_id is not null and v_existing.provider_merchant_id<>v_merchant)
        or (v_kind='refund' and v_existing.parent_provider_resource_id is distinct from v_parent_id) then
        raise exception 'economic replay identity conflict or historical evidence incomplete' using errcode='23505';
      end if;
      v_duplicate:=true;
    end if;
    if v_kind='refund' then
      select count(*) into v_count from public.ifund_subscription_ledger
        where entry_type='payment' and environment='live' and (provider_resource_id=v_parent_id or provider_reference=v_parent_id);
      if v_count<>1 then raise exception 'verified parent payment unavailable' using errcode='22023'; end if;
      select * into v_parent from public.ifund_subscription_ledger
        where entry_type='payment' and environment='live' and (provider_resource_id=v_parent_id or provider_reference=v_parent_id);
      if v_parent.intent_id is distinct from v_intent.id or v_parent.member_id is distinct from v_intent.member_id
        or v_parent.paypal_subscription_id is distinct from v_intent.paypal_subscription_id
        or v_parent.currency<>'USD' or v_parent.provider_reference is distinct from v_parent_id
        or v_parent.provider_occurred_at>v_at
        or (v_parent.provider_merchant_id is not null and v_parent.provider_merchant_id<>v_merchant) then
        raise exception 'refund parent identity mismatch' using errcode='22023';
      end if;
      if exists(select 1 from public.ifund_subscription_ledger where intent_id=v_intent.id
        and entry_type in('refund','reversal') and parent_provider_resource_id is null) then
        raise exception 'historical refund parent reconciliation required' using errcode='55000';
      end if;
      if not v_duplicate and v_amount>(select v_parent.amount_cents+coalesce(sum(amount_cents),0)
        from public.ifund_subscription_ledger where intent_id=v_intent.id and entry_type in('refund','reversal')
          and parent_provider_resource_id=v_parent_id) then
        raise exception 'refund exceeds parent payment remainder' using errcode='22023';
      end if;
    end if;
    if not v_duplicate then
      v_key:='paypal:subscription:'||v_kind||':'||v_resource;
      insert into public.ifund_subscription_ledger(operation_key,intent_id,member_id,paypal_subscription_id,
        provider_reference,provider_resource_id,parent_provider_resource_id,provider_merchant_id,
        entry_type,amount_cents,currency,environment,provider_occurred_at)
      values(v_key,v_intent.id,v_intent.member_id,v_intent.paypal_subscription_id,v_resource,v_resource,
        v_parent_id,v_merchant,v_kind,case when v_kind='payment' then v_amount else -v_amount end,'USD','live',v_at);
    end if;
    insert into public.ifund_subscription_events(paypal_event_id,paypal_subscription_id,event_type,verified_fingerprint)
      values(v_event_id,v_intent.paypal_subscription_id,v_event_type,v_fingerprint)
      on conflict(paypal_event_id) do nothing;
    -- Detect a cross-intent concurrent reuse of a transport event ID atomically.
    select verified_fingerprint into v_prior_fingerprint from public.ifund_subscription_events where paypal_event_id=v_event_id;
    if v_prior_fingerprint is distinct from v_fingerprint then raise exception 'provider event race identity conflict' using errcode='23505'; end if;
  end if;
  -- Refunds cannot grant entitlement; ACTIVE status needs a newer verified payment.
  v_status:=case when v_effective_status in('CANCELLED','EXPIRED') then 'canceled'
    when v_effective_status='SUSPENDED' or v_kind='refund' then 'past_due'
    when v_effective_status='ACTIVE' and exists(select 1 from public.ifund_subscription_ledger p
      where p.intent_id=v_intent.id and p.entry_type='payment' and p.provider_reference is not null
        and p.provider_occurred_at>coalesce((select max(r.provider_occurred_at) from public.ifund_subscription_ledger r
          where r.intent_id=v_intent.id and r.entry_type in('refund','reversal')),'-infinity'::timestamptz)) then 'active'
    else 'pending' end;
  v_rank:=case v_status when 'canceled' then 3 when 'past_due' then 2 when 'active' then 1 else 0 end;
  v_state_at:=case when v_kind='status' then v_effective_status_at
    when v_effective_status in('CANCELLED','EXPIRED','SUSPENDED') then greatest(v_effective_status_at,v_at) else v_at end;
  v_floor:=greatest(v_intent.last_state_event_at,v_intent.last_payment_at,v_intent.last_reversal_at);
  if v_floor is null or (v_state_at,v_rank)>(v_floor,v_intent.last_state_event_rank) then
    update public.ifund_subscription_intents set status=v_status,last_state_event_at=v_state_at,
      last_state_event_rank=v_rank,updated_at=now() where id=v_intent.id;
    v_applied:=true;
  end if;
  if v_kind='payment' and (v_intent.last_payment_at is null or v_at>v_intent.last_payment_at) then
    update public.ifund_subscription_intents set last_payment_at=v_at,last_payment_cents=v_amount where id=v_intent.id;
  elsif v_kind='refund' and (v_intent.last_reversal_at is null or v_at>v_intent.last_reversal_at) then
    update public.ifund_subscription_intents set last_reversal_at=v_at where id=v_intent.id;
  end if;
  update public.ifund_subscription_intents set last_provider_status=v_effective_status,
    last_provider_status_at=v_effective_status_at where id=v_intent.id
      and (last_provider_status,last_provider_status_at) is distinct from (v_effective_status,v_effective_status_at);
  return jsonb_build_object('ok',true,'duplicate',v_duplicate,'state_applied',v_applied,
    'status',(select status from public.ifund_subscription_intents where id=v_intent.id));
end $$;
revoke all on function public.ifund_apply_verified_subscription_event(jsonb) from public,anon,authenticated;
grant execute on function public.ifund_apply_verified_subscription_event(jsonb) to service_role;
