-- Standalone embedded platform-support donations. No campaign ID, no campaign
-- donation row, no campaign total, no withdrawal, no 7% fee. The only grant
-- path is the provider-attested, service-role-only atomic RPCs called by the
-- signed ledger Edge Function.
-- SOURCE ONLY: apply to Supabase and deploy the matching Edge Function before
-- enabling the Worker routes; until then the signed-ledger calls fail closed
-- and no embedded platform-support order can be created.
create table if not exists public.ifund_platform_support_donations (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  donor_id uuid references auth.users(id) on delete set null,
  custom_id text not null unique,
  payment_channel text not null check (payment_channel in ('paypal','card','googlepay','applepay','venmo')),
  amount_cents bigint not null check (amount_cents>=100 and amount_cents<=100000000),
  currency text not null default 'USD' check (currency='USD'),
  environment text not null default 'live' check (environment='live'),
  checkout_token_hash text not null check (checkout_token_hash ~ '^[0-9a-f]{64}$'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  provider_merchant_id text,
  status text not null default 'initiated' check (status in ('initiated','created','approved','captured')),
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_platform_support_receipt_complete check (
    status<>'captured' or
    (paypal_order_id is not null and paypal_capture_id is not null and captured_at is not null)
  )
);
create index if not exists ifund_platform_support_donor_idx
  on public.ifund_platform_support_donations(donor_id,created_at desc);
alter table public.ifund_platform_support_donations enable row level security;
revoke all on public.ifund_platform_support_donations from public,anon,authenticated;
grant all on public.ifund_platform_support_donations to service_role;
grant select on public.ifund_platform_support_donations to authenticated;
drop policy if exists ifund_platform_support_owner_read on public.ifund_platform_support_donations;
create policy ifund_platform_support_owner_read
 on public.ifund_platform_support_donations for select to authenticated
 using ((select auth.uid())=donor_id);

-- Webhook delivery receipts for platform-support captures, mirroring
-- ifund_payment_events for campaign gifts. PayPal event IDs are unique, so a
-- redelivered notification is recorded once.
create table if not exists public.ifund_platform_support_events (
  paypal_event_id text primary key,
  paypal_order_id text not null,
  paypal_capture_id text not null,
  event_type text not null,
  created_at timestamptz not null default now()
);
alter table public.ifund_platform_support_events enable row level security;
revoke all on public.ifund_platform_support_events from public,anon,authenticated;
grant all on public.ifund_platform_support_events to service_role;

-- Create a platform-support checkout intent atomically. The request key is
-- the idempotency key: a retry returns the same intent, and any conflicting
-- amount, channel, token hash, or donor identity fails closed.
-- Guests have no owner to serialize on, so the key itself is the lock.
create or replace function public.ifund_platform_support_begin(
  p_request_key text,p_amount_cents bigint,p_checkout_token_hash text,
  p_payment_channel text,p_donor_id uuid
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v public.ifund_platform_support_donations%rowtype;
begin
 if current_user<>'service_role' then
   raise exception 'service role required' using errcode='42501';
 end if;
 if p_request_key !~ '^[A-Za-z0-9_-]{16,100}$'
   or p_amount_cents is null or p_amount_cents<100 or p_amount_cents>100000000
   or p_checkout_token_hash !~ '^[0-9a-f]{64}$'
   or p_payment_channel not in ('paypal','card','googlepay','applepay','venmo')
 then raise exception 'invalid platform support request' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_key,91827));
 select * into v from public.ifund_platform_support_donations
   where request_key=p_request_key for update;
 if found then
   if v.amount_cents<>p_amount_cents or v.checkout_token_hash<>p_checkout_token_hash
     or v.payment_channel<>p_payment_channel or v.donor_id is distinct from p_donor_id
   then raise exception 'platform support request identity conflict' using errcode='23505'; end if;
   return jsonb_build_object('ok',true,'support_id',v.id,
      'order_id',v.paypal_order_id,'status',v.status,'custom_id',v.custom_id);
 end if;
 insert into public.ifund_platform_support_donations
  (request_key,donor_id,custom_id,payment_channel,amount_cents,currency,environment,
   checkout_token_hash,status)
 values(p_request_key,p_donor_id,'IFUND-PLATFORM-'||gen_random_uuid()::text,
   p_payment_channel,p_amount_cents,'USD','live',p_checkout_token_hash,'initiated')
 returning * into v;
 return jsonb_build_object('ok',true,'support_id',v.id,
   'order_id',null,'status',v.status,'custom_id',v.custom_id);
end $$;
revoke all on function public.ifund_platform_support_begin(text,bigint,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.ifund_platform_support_begin(text,bigint,text,text,uuid)
  to service_role;

-- Finalize only a provider-verified capture. Re-finalizing the same capture
-- is an idempotent duplicate; a different capture for the same intent, or the
-- same capture for a different intent, fails closed. No campaign, ledger, or
-- withdrawal row is written here by design.
create or replace function public.ifund_platform_support_finalize(
  p_support_id uuid,p_order_id text,p_capture_id text,
  p_merchant_id text,p_captured_at timestamptz,p_custom_id text
) returns jsonb
language plpgsql security invoker
set search_path='' set "TimeZone"='UTC'
as $$
declare
 v public.ifund_platform_support_donations%rowtype;
 v_at timestamptz;
begin
 if current_user<>'service_role' then
   raise exception 'service role required' using errcode='42501';
 end if;
 if p_order_id !~ '^[A-Za-z0-9_-]{8,100}$'
   or p_capture_id !~ '^[A-Za-z0-9_-]{8,100}$'
   or p_custom_id !~ '^IFUND-PLATFORM-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or (p_merchant_id is not null and nullif(p_merchant_id,'') is null)
   or (p_captured_at is not null
     and (p_captured_at > now()+interval '5 minutes'
       or p_captured_at < now()-interval '7 days'))
 then raise exception 'invalid immutable provider receipt' using errcode='22023'; end if;
 select * into v from public.ifund_platform_support_donations
 where id=p_support_id for update;
 if not found or v.custom_id<>p_custom_id
   or v.paypal_order_id is distinct from p_order_id
   or v.amount_cents<100 or v.currency<>'USD' or v.environment<>'live'
 then raise exception 'platform support identity conflict' using errcode='22023'; end if;
 if v.status='captured' then
   if v.paypal_capture_id is distinct from p_capture_id
   then raise exception 'replayed capture conflicts' using errcode='23505'; end if;
   return jsonb_build_object('ok',true,'support_id',v.id,'status','captured',
      'duplicate',true);
 end if;
 if v.status not in ('created','approved') then raise exception 'platform support not capturable' using errcode='22023'; end if;
 if exists(select 1 from public.ifund_platform_support_donations
   where paypal_capture_id=p_capture_id and id<>p_support_id)
 then raise exception 'capture already allocated' using errcode='23505'; end if;
 v_at=coalesce(p_captured_at,now());
 update public.ifund_platform_support_donations set
   paypal_capture_id=p_capture_id,provider_merchant_id=p_merchant_id,
   status='captured',captured_at=v_at,updated_at=now() where id=v.id;
 return jsonb_build_object('ok',true,'support_id',v.id,'status','captured',
   'duplicate',false);
end $$;
revoke all on function public.ifund_platform_support_finalize(uuid,text,text,text,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.ifund_platform_support_finalize(uuid,text,text,text,timestamptz,text)
 to service_role;
