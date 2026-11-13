-- PULSE opt-in deadline/status alerts from canonical opportunity changes.
-- Staged; no external provider polling or notification service is claimed.
create table if not exists public.ifund_opportunity_watches (
 owner_id uuid not null references auth.users(id) on delete cascade,
 opportunity_id text not null references public.ifund_opportunity(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(owner_id,opportunity_id)
);
alter table public.ifund_opportunity_watches enable row level security;
revoke all on public.ifund_opportunity_watches from public,anon,authenticated;

create or replace function public.ifund_set_opportunity_watch(p_opportunity_id text,p_enabled boolean)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();v_exists boolean;
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
   or not exists(select 1 from auth.users u where u.id=v_owner and u.email_confirmed_at is not null and u.is_anonymous is false)
 then raise exception 'Confirmed active account required' using errcode='42501'; end if;
 if p_opportunity_id is null or length(p_opportunity_id)>128 or p_enabled is null
 then raise exception 'Invalid watch request' using errcode='22023'; end if;
 if p_enabled then
   select exists(select 1 from public.ifund_opportunity o
     where o.id=p_opportunity_id and o.verified_at is not null) into v_exists;
   if not v_exists then raise exception 'Verified opportunity not found' using errcode='22023'; end if;
   insert into public.ifund_opportunity_watches(owner_id,opportunity_id)
   values(v_owner,p_opportunity_id) on conflict do nothing;
 else
   delete from public.ifund_opportunity_watches
   where owner_id=v_owner and opportunity_id=p_opportunity_id;
 end if;
 return p_enabled;
end $$;

create or replace function public.ifund_my_opportunity_watches()
returns table(opportunity_id text,created_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active account required' using errcode='42501'; end if;
 return query select w.opportunity_id,w.created_at from public.ifund_opportunity_watches w
 where w.owner_id=v_owner order by w.created_at desc limit 100;
end $$;

create or replace function public.ifund_opportunity_watch_source_update()
returns trigger language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_watch record;v_key text;
begin
 if (old.deadline_date is not distinct from new.deadline_date)
    and (old.status is not distinct from new.status) then return new; end if;
 if new.verified_at is null then return new; end if;
 for v_watch in select w.owner_id from public.ifund_opportunity_watches w
    where w.opportunity_id=new.id loop
   v_key:=left('pulse:deadline:'||new.id||':'||v_watch.owner_id::text||':'||txid_current()::text,256);
   insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id)
   values(v_watch.owner_id,'Watched opportunity changed',
     'An opportunity you watch has new recorded deadline or status information. Recheck official provider requirements.',
     'system','/institutions',v_key);
 end loop;
 return new;
end $$;
drop trigger if exists ifund_opportunity_watch_change_trigger on public.ifund_opportunity;
create trigger ifund_opportunity_watch_change_trigger
after update of deadline_date,status on public.ifund_opportunity
for each row execute function public.ifund_opportunity_watch_source_update();

revoke all on function public.ifund_set_opportunity_watch(text,boolean) from public,anon;
revoke all on function public.ifund_my_opportunity_watches() from public,anon;
grant execute on function public.ifund_set_opportunity_watch(text,boolean) to authenticated;
grant execute on function public.ifund_my_opportunity_watches() to authenticated;
