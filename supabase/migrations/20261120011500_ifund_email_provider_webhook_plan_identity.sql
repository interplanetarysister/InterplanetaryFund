-- Signed PayPal webhook adapter looks up the merchant identity of the
-- previously provider-verified $1/month plan. Never exposed to user JWTs.
create or replace function public.ifund_campaign_email_provider_plan_identity(
 p_plan_id text
) returns jsonb language plpgsql stable security invoker
set search_path='' as $$
declare p ifund_ops.campaign_email_billing_plan%rowtype;
begin
 if current_user<>'service_role' then
   raise exception 'Trusted provider adapter required' using errcode='42501';end if;
 if p_plan_id is null or p_plan_id !~ '^P-[A-Z0-9]{20,32}$' then
   raise exception 'Invalid plan identity' using errcode='22023';end if;
 select * into p from ifund_ops.campaign_email_billing_plan
   where singleton=true and provider_plan_id=p_plan_id
   and enabled and provider='paypal' and environment='live'
   and amount_cents=100 and currency='USD' and interval='monthly'
   and provider_verified_at<=now()
   and webhook_verified_at is not null and webhook_verified_at<=now();
 if not found then raise exception 'Plan has not been verified' using errcode='42501';end if;
 return jsonb_build_object('plan_id',p.provider_plan_id,
   'merchant_id',p.merchant_id,'verified',true);
end $$;
revoke all on function public.ifund_campaign_email_provider_plan_identity(text)
 from public,anon,authenticated;
grant execute on function public.ifund_campaign_email_provider_plan_identity(text)
 to service_role;
