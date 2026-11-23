-- Enable verified active members to buy non-renewing Premium without an administrator allowlist.
-- Preserve service-only access, account verification, duplicate intent fencing, and $4.99/USD.
-- Create a member's nonrenewing purchase atomically. Separate read + insert
-- from an Edge function can race across two tabs; this RPC serializes by owner.
create or replace function public.ifund_premium_one_time_begin(
  p_member_id uuid,p_request_key text,p_checkout_token_hash text,p_payment_channel text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v public.ifund_premium_one_time_purchases%rowtype;
 v_now timestamptz:=statement_timestamp();
begin
 if current_user<>'service_role' then
   raise exception 'service role required' using errcode='42501';
 end if;
 if p_member_id is null or p_request_key !~ '^[A-Za-z0-9_-]{16,100}$'
   or p_checkout_token_hash !~ '^[0-9a-f]{64}$'
   or p_payment_channel not in ('paypal','card','googlepay')
 then raise exception 'invalid checkout request' using errcode='22023'; end if;
 if not exists (
   select 1 from auth.users u
   join public.ifund_profiles p on p.id=u.id
   where u.id=p_member_id and u.email_confirmed_at is not null
     and coalesce(u.is_anonymous,false)=false
     and p.account_status='active' and p.account_deletion_pending is false
 ) then raise exception 'verified active member required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_member_id::text,73214));
 select * into v from public.ifund_premium_one_time_purchases
   where request_key=p_request_key for update;
 if found then
   if v.member_id<>p_member_id or v.checkout_token_hash<>p_checkout_token_hash
     or v.payment_channel<>p_payment_channel or v.status='refunded'
   then raise exception 'purchase request identity conflict' using errcode='23505'; end if;
   return jsonb_build_object('ok',true,'purchase_id',v.id,
      'order_id',v.paypal_order_id,'status',v.status,'custom_id',v.custom_id);
 end if;
 if exists(select 1 from public.ifund_subscription_intents
    where member_id=p_member_id and status in ('initiated','approval_pending','pending','active','past_due'))
 then raise exception 'existing recurring plan requires management' using errcode='23505'; end if;
 if exists(select 1 from ifund_access.member_entitlements
    where owner_id=p_member_id and status='active' and valid_until>v_now)
 then raise exception 'active Premium entitlement already exists' using errcode='23505'; end if;
 if exists(select 1 from public.ifund_premium_one_time_purchases
    where member_id=p_member_id
      and ((status in ('initiated','created') and updated_at>v_now-interval '24 hours')
        or(status='captured' and valid_until>v_now)))
 then raise exception 'an existing Premium purchase must be completed or reconciled first' using errcode='23505'; end if;
 insert into public.ifund_premium_one_time_purchases
  (member_id,request_key,checkout_token_hash,custom_id,payment_channel,
   amount_cents,currency,environment,status)
 values(p_member_id,p_request_key,p_checkout_token_hash,'IFUND-PREMIUM-'||gen_random_uuid()::text,
   p_payment_channel,499,'USD','live','initiated') returning * into v;
 return jsonb_build_object('ok',true,'purchase_id',v.id,
   'order_id',null,'status',v.status,'custom_id',v.custom_id);
end $$;
revoke all on function public.ifund_premium_one_time_begin(uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ifund_premium_one_time_begin(uuid,text,text,text) to service_role;
