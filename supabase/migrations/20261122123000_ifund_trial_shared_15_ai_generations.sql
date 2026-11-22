-- A single fifteen-item allowance shared by AI content generation types.
-- Manual campaign writing, uploads and publishing never call these functions.
-- All authority is derived from auth.uid(), confirmed subscription and trial.
create table if not exists public.ifund_trial_ai_generations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check(kind in ('campaign_story','image','image_edit','video','audio','marketing')),
  state text not null check(state in ('reserved','completed')),
  reserved_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  primary key(owner_id,request_id),
  check ((state='reserved' and reserved_until is not null and completed_at is null)
      or (state='completed' and completed_at is not null and reserved_until is null))
);
create index if not exists ifund_trial_ai_generations_owner_status
  on public.ifund_trial_ai_generations(owner_id,state,reserved_until);
alter table public.ifund_trial_ai_generations enable row level security;
revoke all on public.ifund_trial_ai_generations from public,anon,authenticated;

create or replace function public.ifund_trial_ai_generation_reserve(p_request_id uuid,p_kind text)
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='4s'
as $body$
declare
 v_uid uuid:=auth.uid();
 v_ent jsonb;
 v_count integer;
 v_existing public.ifund_trial_ai_generations%rowtype;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or p_request_id is null or p_kind is null
    or p_kind not in ('campaign_story','image','image_edit','video','audio','marketing')
    or not coalesce(public.ifund_current_user_has_current_terms(),false)
    or not coalesce(public.ifund_current_account_is_active(),false) then
    raise exception 'Verified and authorized account required' using errcode='42501';
 end if;
 -- Begin the actual signup trial only after verified member access.
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 if coalesce((v_ent->>'active')::boolean,false) is not true then
    return jsonb_build_object('allowed',false,'state','membership_required','limit',15);
 end if;
 if v_ent->>'status'<>'trialing' then
    return jsonb_build_object('allowed',true,'state','paid_or_admin_exempt','limit',null);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifund-trial-ai:'||v_uid::text,0));
 select * into v_existing from public.ifund_trial_ai_generations
 where owner_id=v_uid and request_id=p_request_id for update;
 if found then
   if v_existing.kind<>p_kind then
     raise exception 'Trial generation idempotency conflict' using errcode='23505';
   end if;
   if v_existing.state='completed' then
     return jsonb_build_object('allowed',false,'state','already_completed','limit',15);
   end if;
   if v_existing.reserved_until>statement_timestamp() then
     return jsonb_build_object('allowed',false,'state','already_reserved','limit',15);
   end if;
 end if;
 select count(*)::integer into v_count from public.ifund_trial_ai_generations
  where owner_id=v_uid and (state='completed'
    or (state='reserved' and reserved_until>statement_timestamp()));
 if v_count>=15 then
   return jsonb_build_object('allowed',false,'state','trial_limit','limit',15,'remaining',0);
 end if;
 insert into public.ifund_trial_ai_generations
   (owner_id,request_id,kind,state,reserved_until,completed_at)
 values(v_uid,p_request_id,p_kind,'reserved',statement_timestamp()+interval '30 minutes',null)
 on conflict(owner_id,request_id) do update
  set state='reserved',reserved_until=statement_timestamp()+interval '30 minutes',completed_at=null
  where public.ifund_trial_ai_generations.state='reserved'
   and public.ifund_trial_ai_generations.reserved_until<=statement_timestamp();
 if not found then
  return jsonb_build_object('allowed',false,'state','already_reserved','limit',15);
 end if;
 return jsonb_build_object('allowed',true,'state','reserved','limit',15,
   'remaining',15-v_count-1);
end $body$;

create or replace function public.ifund_trial_ai_generation_complete(p_request_id uuid,p_kind text)
returns boolean language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or p_request_id is null or p_kind is null then
    raise exception 'Invalid generation reference' using errcode='22023';
 end if;
 update public.ifund_trial_ai_generations
  set state='completed',completed_at=statement_timestamp(),reserved_until=null
  where owner_id=v_uid and request_id=p_request_id and kind=p_kind
   and state='reserved' and reserved_until>statement_timestamp();
 if found then return true; end if;
 return exists(select 1 from public.ifund_trial_ai_generations
   where owner_id=v_uid and request_id=p_request_id and kind=p_kind and state='completed');
end $body$;

create or replace function public.ifund_trial_ai_generation_release(p_request_id uuid,p_kind text)
returns boolean language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or p_request_id is null or p_kind is null then
   raise exception 'Invalid generation reference' using errcode='22023';
 end if;
 delete from public.ifund_trial_ai_generations
 where owner_id=v_uid and request_id=p_request_id and kind=p_kind and state='reserved';
 return found;
end $body$;

create or replace function public.ifund_trial_ai_generation_status()
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
declare
 v_uid uuid:=auth.uid();v_ent jsonb;v_used integer;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not coalesce(public.ifund_current_account_is_active(),false) then
   raise exception 'Verified member required' using errcode='42501';
 end if;
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 select count(*)::integer into v_used from public.ifund_trial_ai_generations
  where owner_id=v_uid and (state='completed' or
   (state='reserved' and reserved_until>statement_timestamp()));
 return jsonb_build_object('limit',15,'used',v_used,'remaining',greatest(0,15-v_used),
   'trial',v_ent->>'status'='trialing',
   'entitled',coalesce((v_ent->>'active')::boolean,false));
end $body$;

revoke all on function public.ifund_trial_ai_generation_reserve(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_trial_ai_generation_complete(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_trial_ai_generation_release(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_trial_ai_generation_status() from public,anon,authenticated;
grant execute on function public.ifund_trial_ai_generation_reserve(uuid,text) to authenticated;
grant execute on function public.ifund_trial_ai_generation_complete(uuid,text) to authenticated;
-- Deliberately no authenticated GRANT on release: browser users must never
-- delete their own in-flight reservations to bypass the 15-item cap.
grant execute on function public.ifund_trial_ai_generation_status() to authenticated;
