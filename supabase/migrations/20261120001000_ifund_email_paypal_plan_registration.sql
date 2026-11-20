-- Trusted PayPal adapter may record a verified $1/month plan once.
-- The browser cannot create, replace, or enable a plan or merchant identity.
create or replace function public.ifund_register_campaign_email_verified_plan(
 p_plan_id text,p_product_id text,p_merchant_id text,
 p_verified_at timestamptz,p_webhook_verified_at timestamptz
)
returns jsonb language plpgsql volatile security invoker
set search_path='' set lock_timeout='3s'
as $$
declare v_existing ifund_ops.campaign_email_billing_plan%rowtype;
begin
 if current_user<>'service_role' then
   raise exception 'Trusted provider adapter required' using errcode='42501';end if;
 if p_plan_id !~ '^P-[A-Z0-9]{20,32}$'
   or char_length(coalesce(p_product_id,'')) not between 8 and 64
   or char_length(coalesce(p_merchant_id,'')) not between 8 and 80
   or p_verified_at is null or p_verified_at>now()
   or p_webhook_verified_at is null or p_webhook_verified_at>now()
 then raise exception 'PayPal plan evidence invalid' using errcode='22023';end if;
 select * into v_existing from ifund_ops.campaign_email_billing_plan
   where singleton=true for update;
 if found then
   if v_existing.provider_plan_id is distinct from p_plan_id or
      v_existing.provider_product_id is distinct from p_product_id or
      v_existing.merchant_id is distinct from p_merchant_id
   then raise exception 'Existing email plan identity conflict' using errcode='23505';end if;
   update ifund_ops.campaign_email_billing_plan
     set provider_verified_at=greatest(provider_verified_at,p_verified_at),
         webhook_verified_at=greatest(webhook_verified_at,p_webhook_verified_at),
         enabled=true,updated_at=now()
     where singleton=true;
 else
   insert into ifund_ops.campaign_email_billing_plan
     (singleton,provider,provider_plan_id,provider_product_id,
      amount_cents,currency,interval,environment,merchant_id,
      provider_verified_at,webhook_verified_at,enabled)
   values (true,'paypal',p_plan_id,p_product_id,
     100,'USD','monthly','live',p_merchant_id,
     p_verified_at,p_webhook_verified_at,true);
 end if;
 return jsonb_build_object('verified',true,'plan_id',p_plan_id);
end;
$$;
revoke all on function public.ifund_register_campaign_email_verified_plan(
 text,text,text,timestamptz,timestamptz
) from public,anon,authenticated;
grant execute on function public.ifund_register_campaign_email_verified_plan(
 text,text,text,timestamptz,timestamptz
) to service_role;
