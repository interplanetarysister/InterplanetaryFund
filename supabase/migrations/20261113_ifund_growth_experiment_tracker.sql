-- FORGE owner-only outreach experiment log. Never sends outreach and does not
-- treat self-reported outcomes as provider-verified campaign captures.
create table if not exists public.ifund_growth_experiments (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
 channel text not null check(channel in ('email','social','community','in_person','other')),
 hypothesis text not null check(char_length(hypothesis) between 15 and 500),
 outcome_note text,
 status text not null default 'planned' check(status in ('planned','closed')),
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 constraint ifund_experiment_outcome_length check(outcome_note is null or char_length(outcome_note)<=1000)
);
create index if not exists ifund_growth_experiments_owner_idx on public.ifund_growth_experiments(owner_id,created_at desc);
alter table public.ifund_growth_experiments enable row level security;
revoke all on public.ifund_growth_experiments from public,anon,authenticated;

create or replace function public.ifund_create_growth_experiment(p_campaign_id uuid,p_channel text,p_hypothesis text)
returns uuid language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();v_id uuid;
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
   or not exists(select 1 from auth.users u where u.id=v_owner and u.is_anonymous is false and u.email_confirmed_at is not null)
 then raise exception 'Confirmed active owner required' using errcode='42501'; end if;
 if not exists(select 1 from public.ifund_campaigns c where c.id=p_campaign_id and c.owner_id=v_owner)
 then raise exception 'Owned campaign required' using errcode='42501'; end if;
 if p_channel not in ('email','social','community','in_person','other')
   or p_hypothesis is null or char_length(btrim(p_hypothesis)) not between 15 and 500
 then raise exception 'Invalid experiment details' using errcode='22023'; end if;
 if (select count(*) from public.ifund_growth_experiments e
     where e.owner_id=v_owner and e.status='planned')>=20 then
   raise exception 'Too many open experiments' using errcode='22023'; end if;
 insert into public.ifund_growth_experiments(owner_id,campaign_id,channel,hypothesis)
 values(v_owner,p_campaign_id,p_channel,btrim(p_hypothesis)) returning id into v_id;
 return v_id;
end $$;

create or replace function public.ifund_my_growth_experiments()
returns table(experiment_id uuid,campaign_id uuid,channel text,hypothesis text,outcome_note text,status text,created_at timestamptz,closed_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active owner required' using errcode='42501';end if;
 return query select e.id,e.campaign_id,e.channel,e.hypothesis,e.outcome_note,e.status,e.created_at,e.closed_at
 from public.ifund_growth_experiments e where e.owner_id=v_owner order by e.created_at desc limit 100;
end $$;

create or replace function public.ifund_close_growth_experiment(p_experiment_id uuid,p_outcome text)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare n int;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_outcome is null or char_length(btrim(p_outcome)) not between 10 and 1000
 then raise exception 'Describe the observed outcome in 10–1000 characters' using errcode='22023';end if;
 update public.ifund_growth_experiments e
 set status='closed',outcome_note=btrim(p_outcome),closed_at=now()
 where e.id=p_experiment_id and e.owner_id=auth.uid() and e.status='planned';
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function public.ifund_create_growth_experiment(uuid,text,text) from public,anon;
revoke all on function public.ifund_my_growth_experiments() from public,anon;
revoke all on function public.ifund_close_growth_experiment(uuid,text) from public,anon;
grant execute on function public.ifund_create_growth_experiment(uuid,text,text) to authenticated;
grant execute on function public.ifund_my_growth_experiments() to authenticated;
grant execute on function public.ifund_close_growth_experiment(uuid,text) to authenticated;
