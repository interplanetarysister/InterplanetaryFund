-- A private, idempotent PayPal recurring checkout intent for Basic email add-on.
-- No charge, subscription, entitlement or routing is activated by this RPC.
create table if not exists ifund_ops.campaign_email_checkout_intents (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 provider text not null default 'paypal' check(provider='paypal'),
 plan_id text not null check(plan_id ~ '^P-[A-Z0-9]{20,32}$'),
 custom_id text not null unique check(char_length(custom_id) between 20 and 127),
 paypal_subscription_id text unique
  check(paypal_subscription_id is null or paypal_subscription_id ~ '^I-[A-Z0-9]{10,30}$'),
 status text not null default 'requested'
  check(status in ('requested','provider_created','pending','active','past_due','cancelled','expired','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ifund_campaign_email_checkout_owner_idx
 on ifund_ops.campaign_email_checkout_intents(owner_id,created_at desc);
revoke all on ifund_ops.campaign_email_checkout_intents
 from public,anon,authenticated;
alter table ifund_ops.campaign_email_checkout_intents enable row level security;

create or replace function public.ifund_begin_campaign_email_checkout(p_request_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare
 v_owner uuid:=auth.uid();
 v_plan ifund_ops.campaign_email_billing_plan%rowtype;
 v_intent ifund_ops.campaign_email_checkout_intents%rowtype;
 v_status jsonb;
 v_now timestamptz:=clock_timestamp();
begin
 if v_owner is null or p_request_id is null
    or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
      and u.is_anonymous=false and u.email_confirmed_at is not null)
 then raise exception 'Verified active member required' using errcode='42501';end if;
 v_status:=public.ifund_campaign_email_checkout_readiness();
 if coalesce((v_status->>'checkout_ready')::boolean,false) is not true
 then raise exception 'Provider-verified Basic email billing is not ready'
      using errcode='55000';end if;
 select * into v_plan from ifund_ops.campaign_email_billing_plan p
 where p.singleton=true for share;
 if not found or not v_plan.enabled or v_plan.provider_verified_at>v_now
   or v_plan.webhook_verified_at is null or v_plan.webhook_verified_at>v_now
 then raise exception 'PayPal email plan is not ready' using errcode='55000';end if;

 perform pg_advisory_xact_lock(19232,hashtext(v_owner::text));
 select * into v_intent from ifund_ops.campaign_email_checkout_intents
   where id=p_request_id for update;
 if found then
   if v_intent.owner_id is distinct from v_owner or
     v_intent.plan_id is distinct from v_plan.provider_plan_id
   then raise exception 'Checkout idempotency conflict' using errcode='23505';end if;
 else
   if exists(select 1 from ifund_ops.campaign_email_checkout_intents i
     where i.owner_id=v_owner and i.status in('requested','provider_created','pending')
       and i.created_at>v_now-interval '1 day')
   then raise exception 'Existing email checkout requires reconciliation'
        using errcode='55000';end if;
   if (select count(*) from ifund_ops.campaign_email_checkout_intents i
       where i.owner_id=v_owner and i.created_at>=v_now-interval '24 hours')>=3
   then raise exception 'Email checkout daily limit reached' using errcode='22023';end if;
   insert into ifund_ops.campaign_email_checkout_intents
     (id,owner_id,plan_id,custom_id)
   values (p_request_id,v_owner,v_plan.provider_plan_id,
    'ifund-email-addon:'||p_request_id::text)
   returning * into v_intent;
 end if;
 return jsonb_build_object('intent_id',v_intent.id,
   'plan_id',v_intent.plan_id,'custom_id',v_intent.custom_id,
   'status',v_intent.status,'provider_subscription_id',v_intent.paypal_subscription_id,
   'amount_cents',100,'currency','USD','interval','monthly',
   'checkout_completed',false,'addon_active',false);
end;
$$;
revoke all on function public.ifund_begin_campaign_email_checkout(uuid)
 from public,anon,authenticated;
grant execute on function public.ifund_begin_campaign_email_checkout(uuid)
 to authenticated;
