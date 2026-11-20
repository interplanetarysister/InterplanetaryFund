-- Immutable staging ledger for PayPal email-addon evidence.
-- Service-role only. This table deliberately DOES NOT grant paid entitlements.
-- Provider signatures, merchant identity, sale status, and refund proofs must
-- be checked by the trusted PayPal adapter before posting these receipts.
create table if not exists ifund_ops.campaign_email_provider_events(
 paypal_event_id text primary key check(paypal_event_id ~ '^WH-[A-Z0-9-]{8,90}$'),
 intent_id uuid not null references ifund_ops.campaign_email_checkout_intents(id),
 provider_subscription_id text not null
   check(provider_subscription_id ~ '^I-[A-Z0-9]{10,30}$'),
 kind text not null check(kind in ('payment','refund','cancel','suspend')),
 provider_resource_id text not null
   check(provider_resource_id ~ '^[A-Za-z0-9_-]{8,100}$'),
 provider_event_at timestamptz not null,
 merchant_id text not null,
 currency text not null check(currency='USD'),
 amount_cents integer not null check(amount_cents=100),
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 received_at timestamptz not null default now(),
 constraint ifund_email_provider_events_kind_resource
   unique(kind,provider_resource_id)
);
revoke all on ifund_ops.campaign_email_provider_events
 from public,anon,authenticated;
alter table ifund_ops.campaign_email_provider_events enable row level security;

create or replace function public.ifund_bind_campaign_email_provider_checkout(
 p_intent_id uuid,p_subscription_id text,p_plan_id text,p_custom_id text
)
returns boolean language plpgsql volatile security invoker
set search_path='' set lock_timeout='3s'
as $$
declare v_intent ifund_ops.campaign_email_checkout_intents%rowtype;
begin
 if current_user <> 'service_role' then raise exception 'Trusted provider required' using errcode='42501';end if;
 if p_subscription_id !~ '^I-[A-Z0-9]{10,30}$'
    or p_plan_id !~ '^P-[A-Z0-9]{20,32}$'
    or p_intent_id is null or p_custom_id is null then
    raise exception 'Invalid PayPal subscription binding' using errcode='22023';end if;
 select * into v_intent from ifund_ops.campaign_email_checkout_intents
   where id=p_intent_id for update;
 if not found or v_intent.plan_id is distinct from p_plan_id
    or v_intent.custom_id is distinct from p_custom_id
    or v_intent.status not in('requested','provider_created')
    or (v_intent.paypal_subscription_id is not null
      and v_intent.paypal_subscription_id<>p_subscription_id)
 then raise exception 'Provider subscription does not match owner checkout'
      using errcode='42501';end if;
 update ifund_ops.campaign_email_checkout_intents
   set paypal_subscription_id=p_subscription_id,
       status='provider_created',updated_at=now()
   where id=p_intent_id;
 return true;
end;
$$;

create or replace function public.ifund_stage_campaign_email_provider_event(
 p_event jsonb
)
returns jsonb language plpgsql volatile security invoker
set search_path='' set lock_timeout='3s'
as $$
declare
 v_intent ifund_ops.campaign_email_checkout_intents%rowtype;
 v_plan ifund_ops.campaign_email_billing_plan%rowtype;
 v_kind text:=p_event->>'kind';
 v_at timestamptz;
 v_fingerprint text;
 v_previous ifund_ops.campaign_email_provider_events%rowtype;
 v_event text:=p_event->>'event_id';
 v_resource text:=p_event->>'resource_id';
 v_subscription text:=p_event->>'subscription_id';
 v_merchant text:=p_event->>'merchant_id';
begin
 if current_user<>'service_role' then
   raise exception 'Trusted provider required' using errcode='42501';end if;
 if jsonb_typeof(p_event)<>'object'
   or v_kind not in('payment','refund','cancel','suspend')
   or v_event !~ '^WH-[A-Z0-9-]{8,90}$'
   or v_resource !~ '^[A-Za-z0-9_-]{8,100}$'
   or v_subscription !~ '^I-[A-Z0-9]{10,30}$'
   or p_event->>'currency'<>'USD'
   or p_event->>'amount_cents'<>'100'
   or p_event->>'environment'<>'live'
   or coalesce(p_event->>'provider_verified','')<>'true'
   or coalesce(p_event->>'webhook_verified','')<>'true'
   or p_event->>'intent_id' is null
 then raise exception 'Unverified PayPal email add-on event'
   using errcode='22023';end if;
 begin v_at:=(p_event->>'occurred_at')::timestamptz;
 exception when others then raise exception 'Invalid provider event time' using errcode='22023';end;
 if v_at is null or v_at>now()+interval '5 minutes'
    or v_at<now()-interval '366 days'
 then raise exception 'Provider event date invalid' using errcode='22023';end if;
 begin
   select * into v_intent from ifund_ops.campaign_email_checkout_intents
     where id=(p_event->>'intent_id')::uuid for update;
 exception when invalid_text_representation then
   raise exception 'Provider intent invalid' using errcode='22023';end;
 if not found or v_intent.paypal_subscription_id is distinct from v_subscription
   or v_intent.status not in('provider_created','pending','active','past_due','cancelled')
 then raise exception 'Provider event has no matching checkout' using errcode='42501';end if;
 select * into v_plan from ifund_ops.campaign_email_billing_plan where singleton=true;
 if not found or not v_plan.enabled or v_plan.provider_plan_id is distinct from v_intent.plan_id
   or v_plan.merchant_id is distinct from v_merchant
   or v_plan.provider_verified_at>now() or v_plan.webhook_verified_at is null
 then raise exception 'PayPal plan not independently verified' using errcode='42501';end if;
 v_fingerprint:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into v_previous from ifund_ops.campaign_email_provider_events
   where paypal_event_id=v_event for update;
 if found then
   if v_previous.intent_id is distinct from v_intent.id
      or v_previous.provider_subscription_id is distinct from v_subscription
      or v_previous.kind is distinct from v_kind
      or v_previous.provider_resource_id is distinct from v_resource
      or v_previous.fingerprint is distinct from v_fingerprint
   then raise exception 'Event replay identity conflict' using errcode='23505';end if;
   return jsonb_build_object('accepted',true,'duplicate',true,
     'entitlement_activated',false);
 end if;
 insert into ifund_ops.campaign_email_provider_events
   (paypal_event_id,intent_id,provider_subscription_id,kind,provider_resource_id,
    provider_event_at,merchant_id,currency,amount_cents,fingerprint)
 values(v_event,v_intent.id,v_subscription,v_kind,v_resource,v_at,
        v_merchant,'USD',100,v_fingerprint);
 return jsonb_build_object('accepted',true,'duplicate',false,
   'entitlement_activated',false,'requires_reconciliation',true);
end;
$$;

revoke all on function public.ifund_bind_campaign_email_provider_checkout(uuid,text,text,text)
 from public,anon,authenticated;
revoke all on function public.ifund_stage_campaign_email_provider_event(jsonb)
 from public,anon,authenticated;
grant execute on function public.ifund_bind_campaign_email_provider_checkout(uuid,text,text,text)
 to service_role;
grant execute on function public.ifund_stage_campaign_email_provider_event(jsonb)
 to service_role;
