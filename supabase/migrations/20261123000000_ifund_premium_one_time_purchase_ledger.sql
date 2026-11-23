-- Non-renewing Premium purchases. No donation or recurring-subscription rows.
-- The only grant path is the provider-attested, service-role-only atomic RPC.
create table if not exists public.ifund_premium_one_time_purchases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null unique,
  checkout_token_hash text not null check (checkout_token_hash ~ '^[0-9a-f]{64}$'),
  custom_id text not null unique,
  payment_channel text not null check (payment_channel in ('paypal','card','googlepay')),
  amount_cents bigint not null default 499 check (amount_cents=499),
  currency text not null default 'USD' check (currency='USD'),
  environment text not null default 'live' check (environment='live'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  provider_merchant_id text,
  status text not null default 'initiated' check (status in ('initiated','created','captured','refunded')),
  captured_at timestamptz,
  valid_until timestamptz,
  refunded_at timestamptz,
  provider_refund_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_premium_purchase_receipt_complete check (
    status not in ('captured','refunded') or
    (paypal_order_id is not null and paypal_capture_id is not null and captured_at is not null and valid_until is not null)
  )
);
create index if not exists ifund_premium_one_time_owner_idx
  on public.ifund_premium_one_time_purchases(member_id,created_at desc);
alter table public.ifund_premium_one_time_purchases enable row level security;
revoke all on public.ifund_premium_one_time_purchases from public,anon,authenticated;
grant all on public.ifund_premium_one_time_purchases to service_role;
grant select on public.ifund_premium_one_time_purchases to authenticated;
drop policy if exists ifund_premium_one_time_owner_read on public.ifund_premium_one_time_purchases;
create policy ifund_premium_one_time_owner_read
 on public.ifund_premium_one_time_purchases for select to authenticated
 using ((select auth.uid())=member_id);

create or replace function public.ifund_premium_one_time_finalize(
  p_purchase_id uuid,p_order_id text,p_capture_id text,
  p_merchant_id text,p_captured_at timestamptz,p_custom_id text
) returns jsonb
language plpgsql security invoker
set search_path='' set "TimeZone"='UTC'
as $$
declare
 v public.ifund_premium_one_time_purchases%rowtype;
 v_ent ifund_access.member_entitlements%rowtype;
 v_expiry timestamptz;
begin
 if current_user <> 'service_role' then
   raise exception 'service role required' using errcode='42501';
 end if;
 if p_order_id !~ '^[A-Za-z0-9_-]{8,100}$'
   or p_capture_id !~ '^[A-Za-z0-9_-]{8,100}$'
   or p_custom_id !~ '^IFUND-PREMIUM-[0-9a-f-]{36}$'
   or nullif(p_merchant_id,'') is null
   or p_captured_at is null
   or p_captured_at > now()+interval '5 minutes'
   or p_captured_at < now()-interval '7 days'
 then raise exception 'invalid immutable provider receipt' using errcode='22023'; end if;
 select * into v from public.ifund_premium_one_time_purchases
 where id=p_purchase_id for update;
 if not found or v.custom_id<>p_custom_id
   or v.paypal_order_id is distinct from p_order_id
   or v.amount_cents<>499 or v.currency<>'USD' or v.environment<>'live'
 then raise exception 'purchase identity conflict' using errcode='22023'; end if;
 if v.status='captured' then
   if v.paypal_capture_id is distinct from p_capture_id
      or v.provider_merchant_id is distinct from p_merchant_id
      or v.captured_at is distinct from p_captured_at
   then raise exception 'replayed capture conflicts' using errcode='23505'; end if;
   return jsonb_build_object('ok',true,'purchase_id',v.id,'status','captured',
      'valid_until',v.valid_until,'duplicate',true);
 end if;
 if v.status<>'created' then raise exception 'purchase not capturable' using errcode='22023'; end if;
 if exists(select 1 from public.ifund_premium_one_time_purchases
   where paypal_capture_id=p_capture_id and id<>p_purchase_id)
 then raise exception 'capture already allocated' using errcode='23505'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v.member_id::text, 73214));
 select * into v_ent from ifund_access.member_entitlements
   where owner_id=v.member_id for update;
 if found and v_ent.status='active' and v_ent.valid_until>now()
    and (v_ent.provider is distinct from 'paypal'
      or v_ent.receipt_id is distinct from p_capture_id)
 then raise exception 'another active Premium purchase requires manual reconciliation' using errcode='55000'; end if;
 v_expiry=p_captured_at+interval '1 month';
 update public.ifund_premium_one_time_purchases set
   paypal_capture_id=p_capture_id,provider_merchant_id=p_merchant_id,
   status='captured',captured_at=p_captured_at,valid_until=v_expiry,
   updated_at=now() where id=v.id;
 insert into ifund_access.member_entitlements
   (owner_id,tier,status,verified_at,valid_until,provider,receipt_id)
 values (v.member_id,'basic','active',p_captured_at,v_expiry,'paypal',p_capture_id)
 on conflict(owner_id) do update set
   tier='basic',status='active',verified_at=excluded.verified_at,
   valid_until=excluded.valid_until,provider='paypal',receipt_id=excluded.receipt_id,
   trial_started_at=null,trial_end=null;
 return jsonb_build_object('ok',true,'purchase_id',v.id,
   'status','captured','valid_until',v_expiry,'duplicate',false);
end $$;
revoke all on function public.ifund_premium_one_time_finalize(uuid,text,text,text,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.ifund_premium_one_time_finalize(uuid,text,text,text,timestamptz,text)
 to service_role;

-- A refunded receipt cannot keep Premium active. Refunding other subscribers
-- must not revoke this member's unrelated current entitlement.
create or replace function public.ifund_premium_one_time_refund(
 p_capture_id text,p_refund_id text,p_merchant_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.ifund_premium_one_time_purchases%rowtype;
begin
 if current_user<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
 if p_capture_id !~ '^[A-Za-z0-9_-]{8,100}$'
    or p_refund_id !~ '^[A-Za-z0-9_-]{8,100}$'
    or nullif(p_merchant_id,'') is null then
   raise exception 'invalid refund proof' using errcode='22023'; end if;
 select * into v from public.ifund_premium_one_time_purchases
  where paypal_capture_id=p_capture_id for update;
 if not found or v.provider_merchant_id is distinct from p_merchant_id
   or v.status not in ('captured','refunded') then
   raise exception 'refund purchase identity invalid' using errcode='22023'; end if;
 if v.status='refunded' then
   if v.provider_refund_id is distinct from p_refund_id then
      raise exception 'refund replay conflicts' using errcode='23505'; end if;
   return jsonb_build_object('ok',true,'duplicate',true);
 end if;
 update public.ifund_premium_one_time_purchases set status='refunded',
  provider_refund_id=p_refund_id,refunded_at=now(),updated_at=now()
  where id=v.id;
 update ifund_access.member_entitlements
  set status='cancelled',valid_until=greatest(now(),verified_at+interval '1 second')
  where owner_id=v.member_id and provider='paypal' and receipt_id=v.paypal_capture_id;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.ifund_premium_one_time_refund(text,text,text)
 from public,anon,authenticated;
grant execute on function public.ifund_premium_one_time_refund(text,text,text)
 to service_role;
