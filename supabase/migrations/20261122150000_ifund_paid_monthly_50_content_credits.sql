-- Paid Premium: 50 shared content-generation units per verified monthly PayPal
-- billing receipt, across image, image edits, campaign stories, future media.
-- Trial retains its existing 15 lifetime units. Agent chat is not a generation.
-- Never mint a monthly balance merely because the browser claims it is paid.
create table if not exists public.ifund_paid_ai_generations (
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 payment_id uuid not null references public.ifund_subscription_ledger(id),
 kind text not null check(kind in ('campaign_story','image','image_edit','video','audio','marketing')),
 state text not null check(state in ('reserved','completed')),
 reserved_until timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 primary key(owner_id,request_id),
 check((state='reserved' and reserved_until is not null and completed_at is null)
   or (state='completed' and reserved_until is null and completed_at is not null))
);
create index if not exists ifund_paid_ai_generations_cycle
 on public.ifund_paid_ai_generations(owner_id,payment_id,state,reserved_until);
alter table public.ifund_paid_ai_generations enable row level security;
revoke all on public.ifund_paid_ai_generations from public,anon,authenticated;

-- Resolve a current, non-reversed, verified provider charge for the caller.
-- The verified provider receipt (not a calendar date) defines the monthly cycle.
create or replace function public.ifund_premium_ai_paid_payment_id()
returns uuid language plpgsql stable security definer
set search_path='' set row_security='off'
as $body$
declare
 v_owner uuid:=auth.uid();
 v_ent jsonb;
 v_payment uuid;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not coalesce(public.ifund_current_account_is_active(),false)
  or not coalesce(public.ifund_current_user_has_current_terms(),false) then
   return null;
 end if;
 v_ent:=ifund_story_runtime.subscription();
 if v_ent->>'status'<>'active' or coalesce((v_ent->>'admin_granted')::boolean,false)
    or v_ent->>'tier'<>'basic' then return null; end if;
 select l.id into v_payment
 from public.ifund_subscription_intents i
 join public.ifund_subscription_ledger l
   on l.intent_id=i.id and l.member_id=i.member_id
 where i.member_id=v_owner and i.tier='basic' and i.interval='monthly'
   and i.status='active'
   and i.currency='USD' and i.amount_cents=499
   and i.paypal_plan_id='P-8RG59105D5286480MNMBOKJA'
   and l.entry_type='payment'
   and l.amount_cents=499 and l.currency='USD' and l.environment='live'
   and nullif(l.provider_resource_id,'') is not null
   and l.provider_occurred_at<=statement_timestamp()
   and l.provider_occurred_at+interval '1 month'>statement_timestamp()
   and not exists (
     select 1 from public.ifund_subscription_ledger r
     where r.intent_id=l.intent_id and r.entry_type in ('refund','reversal')
       and r.parent_provider_resource_id=l.provider_resource_id
   )
 order by l.provider_occurred_at desc,l.id desc limit 1;
 return v_payment;
end $body$;
revoke all on function public.ifund_premium_ai_paid_payment_id() from public,anon,authenticated;
grant execute on function public.ifund_premium_ai_paid_payment_id() to authenticated;

create or replace function public.ifund_ai_content_reserve(p_request_id uuid,p_kind text)
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='4s'
as $body$
declare
 v_owner uuid:=auth.uid();
 v_ent jsonb;
 v_payment uuid;
 v_used int;
 v_old public.ifund_paid_ai_generations%rowtype;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or p_request_id is null or p_kind is null
  or p_kind not in ('campaign_story','image','image_edit','video','audio','marketing')
  or not coalesce(public.ifund_current_user_has_current_terms(),false)
  or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active verified member and valid request required' using errcode='42501'; end if;
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 if v_ent->>'status'='trialing' then
   return public.ifund_trial_ai_generation_reserve(p_request_id,p_kind);
 end if;
 if coalesce((v_ent->>'admin_granted')::boolean,false) then
   return jsonb_build_object('allowed',true,'state','admin_exempt','limit',null);
 end if;
 v_payment:=public.ifund_premium_ai_paid_payment_id();
 if v_payment is null then
   return jsonb_build_object('allowed',false,'state','membership_required','limit',50);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifund-premium-ai:'||v_owner::text,0));
 select * into v_old from public.ifund_paid_ai_generations
  where owner_id=v_owner and request_id=p_request_id for update;
 if found then
   if v_old.kind<>p_kind or v_old.payment_id<>v_payment then
      raise exception 'Paid generation idempotency conflict' using errcode='23505';
   end if;
   if v_old.state='completed' then
      return jsonb_build_object('allowed',false,'state','already_completed','limit',50);
   end if;
   if v_old.reserved_until>statement_timestamp() then
      return jsonb_build_object('allowed',false,'state','already_reserved','limit',50);
   end if;
 end if;
 select count(*)::int into v_used from public.ifund_paid_ai_generations
  where owner_id=v_owner and payment_id=v_payment
   and (state='completed' or (state='reserved' and reserved_until>statement_timestamp()));
 if v_used>=50 then
   return jsonb_build_object('allowed',false,'state','monthly_limit','limit',50,'remaining',0);
 end if;
 insert into public.ifund_paid_ai_generations(owner_id,request_id,payment_id,kind,state,reserved_until)
 values(v_owner,p_request_id,v_payment,p_kind,'reserved',statement_timestamp()+interval '30 minutes')
 on conflict(owner_id,request_id) do update
  set state='reserved',reserved_until=statement_timestamp()+interval '30 minutes',completed_at=null
  where public.ifund_paid_ai_generations.payment_id=v_payment
    and public.ifund_paid_ai_generations.kind=p_kind
    and public.ifund_paid_ai_generations.state='reserved'
    and public.ifund_paid_ai_generations.reserved_until<=statement_timestamp();
 if not found then
   return jsonb_build_object('allowed',false,'state','already_reserved','limit',50);
 end if;
 return jsonb_build_object('allowed',true,'state','reserved','limit',50,'remaining',49-v_used);
end $body$;

create or replace function public.ifund_ai_content_complete(p_request_id uuid,p_kind text)
returns boolean language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or p_request_id is null or p_kind is null
   then raise exception 'Invalid completion reference' using errcode='22023'; end if;
 if exists(select 1 from public.ifund_paid_ai_generations
    where owner_id=v_owner and request_id=p_request_id and kind=p_kind) then
   update public.ifund_paid_ai_generations
    set state='completed',completed_at=statement_timestamp(),reserved_until=null
    where owner_id=v_owner and request_id=p_request_id and kind=p_kind
      and state='reserved' and reserved_until>statement_timestamp();
   if found then return true; end if;
   return exists(select 1 from public.ifund_paid_ai_generations
    where owner_id=v_owner and request_id=p_request_id and kind=p_kind and state='completed');
 end if;
 return public.ifund_trial_ai_generation_complete(p_request_id,p_kind);
end $body$;

create or replace function public.ifund_ai_content_status()
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
declare
 v_owner uuid:=auth.uid();
 v_ent jsonb;
 v_payment uuid;
 v_used int;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not coalesce(public.ifund_current_account_is_active(),false) then
  raise exception 'Verified member required' using errcode='42501';
 end if;
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 if v_ent->>'status'='trialing' then
   return public.ifund_trial_ai_generation_status();
 end if;
 if coalesce((v_ent->>'admin_granted')::boolean,false) then
   return jsonb_build_object('limit',null,'remaining',null,'used',0,'trial',false,'paid',false,'admin',true);
 end if;
 v_payment:=public.ifund_premium_ai_paid_payment_id();
 if v_payment is null then
   return jsonb_build_object('limit',50,'used',0,'remaining',0,'trial',false,'paid',false,'entitled',false);
 end if;
 select count(*)::int into v_used from public.ifund_paid_ai_generations
 where owner_id=v_owner and payment_id=v_payment
   and (state='completed' or (state='reserved' and reserved_until>statement_timestamp()));
 return jsonb_build_object('limit',50,'used',v_used,'remaining',greatest(0,50-v_used),
   'trial',false,'paid',true,'entitled',true);
end $body$;

revoke all on function public.ifund_ai_content_reserve(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_ai_content_complete(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_ai_content_status() from public,anon,authenticated;
grant execute on function public.ifund_ai_content_reserve(uuid,text) to authenticated;
grant execute on function public.ifund_ai_content_complete(uuid,text) to authenticated;
grant execute on function public.ifund_ai_content_status() to authenticated;
