begin;
-- Owner directive: publication needs title, story and positive amount only.
-- Preserve existing records, owner/current-terms policies and all column grants.
do $$ begin
 if not exists(select 1 from pg_class where oid='public.ifund_campaigns'::regclass and relrowsecurity) then
  raise exception 'Campaign RLS must remain enabled';
 end if;
 if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='ifund_prepublication_story_gate'
  and md5(prosrc) not in ('be7095ef01275654981b1577c382fb76','efa78dd09c3091e9c001ce22c6d12290')) then
  raise exception 'Publication trigger changed; independent reconciliation required';
 end if;
end $$;
alter table public.ifund_campaigns drop constraint if exists ifund_publish_complete;
alter table public.ifund_campaigns add constraint ifund_publish_complete check (
 status <> 'active' or (
  coalesce(title,'') ~ '[^[:space:]]' and coalesce(story,'') ~ '[^[:space:]]'
  and goal_amount is not null and goal_amount > 0 and goal_amount < 'Infinity'::numeric
 )) not valid;
-- Keep publication enforcement in both the trigger and table constraint.
-- The verified old trigger contained only the obsolete story length check.
create or replace function public.ifund_prepublication_story_gate()
returns trigger language plpgsql set search_path='' as $$

begin
 if new.status='active' and (
  coalesce(new.title,'') !~ '[^[:space:]]' or coalesce(new.story,'') !~ '[^[:space:]]'
  or new.goal_amount is null or not(new.goal_amount>0 and new.goal_amount<'Infinity'::numeric)
 ) then
  raise exception 'Publishing requires a title, a story and a positive amount'
   using errcode='23514',constraint='ifund_publish_complete';
 end if;
 return new;
end
$$;
alter table public.ifund_campaigns validate constraint ifund_publish_complete;
commit;
