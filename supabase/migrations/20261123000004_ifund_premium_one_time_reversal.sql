-- Capture reversals can occur without a refund resource ID. Track their
-- immutable signed PayPal event IDs separately from ordinary refunds.
alter table public.ifund_premium_one_time_purchases
 add column if not exists provider_reversal_event_id text unique;
alter table public.ifund_premium_one_time_purchases
 drop constraint if exists ifund_premium_one_time_purchases_status_check;
alter table public.ifund_premium_one_time_purchases
 add constraint ifund_premium_one_time_purchases_status_check
 check(status in ('initiated','created','captured','refunded','reversed'));

create or replace function public.ifund_premium_one_time_reverse(
 p_capture_id text,p_reversal_event_id text,p_merchant_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.ifund_premium_one_time_purchases%rowtype;
begin
 if current_user<>'service_role' then
   raise exception 'service role required' using errcode='42501'; end if;
 if p_capture_id !~ '^[A-Za-z0-9_-]{8,100}$'
   or p_reversal_event_id !~ '^WH-[A-Z0-9-]{8,90}$'
   or nullif(p_merchant_id,'') is null then
     raise exception 'invalid reversal identity' using errcode='22023'; end if;
 select * into v from public.ifund_premium_one_time_purchases
  where paypal_capture_id=p_capture_id for update;
 if not found or v.provider_merchant_id is distinct from p_merchant_id
   or v.status not in ('captured','reversed') then
   raise exception 'purchase reversal identity mismatch' using errcode='22023'; end if;
 if v.status='reversed' then
   if v.provider_reversal_event_id is distinct from p_reversal_event_id then
     raise exception 'reversal replay conflict' using errcode='23505'; end if;
   return jsonb_build_object('ok',true,'duplicate',true);
 end if;
 update public.ifund_premium_one_time_purchases
   set status='reversed',provider_reversal_event_id=p_reversal_event_id,
     refunded_at=now(),updated_at=now() where id=v.id;
 update ifund_access.member_entitlements
   set status='cancelled',valid_until=greatest(now(),verified_at+interval '1 second')
   where owner_id=v.member_id and provider='paypal' and receipt_id=v.paypal_capture_id;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.ifund_premium_one_time_reverse(text,text,text)
 from public,anon,authenticated;
grant execute on function public.ifund_premium_one_time_reverse(text,text,text) to service_role;
