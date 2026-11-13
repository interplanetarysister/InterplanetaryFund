-- Separate explicit fundraising-marketing consent from legacy email update preferences.
-- No migration converts existing email_updates=true into marketing consent.
create table if not exists public.ifund_marketing_consent (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  outreach_opt_in boolean not null default false,
  updated_at timestamptz not null default now(),
  consented_at timestamptz,
  source text not null default 'member_preferences'
);
alter table public.ifund_marketing_consent enable row level security;
revoke all on public.ifund_marketing_consent from public,anon,authenticated;

create or replace function public.ifund_my_marketing_consent()
returns table(outreach_opt_in boolean,consented_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not coalesce(public.ifund_current_account_is_active(),false) then
   raise exception 'Active account required' using errcode='42501';
 end if;
 return query
 select coalesce(c.outreach_opt_in,false),c.consented_at,c.updated_at
 from (select 1) as anchor
 left join public.ifund_marketing_consent c on c.owner_id=v_user;
end
$$;

create or replace function public.ifund_set_marketing_consent(p_opt_in boolean)
returns table(outreach_opt_in boolean,consented_at timestamptz,updated_at timestamptz)
language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not coalesce(public.ifund_current_account_is_active(),false) then
   raise exception 'Active account required' using errcode='42501';
 end if;
 if p_opt_in is null then raise exception 'Explicit choice required' using errcode='22023'; end if;
 insert into public.ifund_marketing_consent(owner_id,outreach_opt_in,consented_at,updated_at,source)
 values(v_user,p_opt_in,case when p_opt_in then now() else null end,now(),'member_preferences')
 on conflict (owner_id) do update set
  outreach_opt_in=excluded.outreach_opt_in,
  consented_at=case when excluded.outreach_opt_in and not public.ifund_marketing_consent.outreach_opt_in
     then now() when excluded.outreach_opt_in then public.ifund_marketing_consent.consented_at else null end,
  updated_at=now(),source='member_preferences';
 return query select c.outreach_opt_in,c.consented_at,c.updated_at
 from public.ifund_marketing_consent c where c.owner_id=v_user;
end
$$;
revoke all on function public.ifund_my_marketing_consent() from public,anon;
revoke all on function public.ifund_set_marketing_consent(boolean) from public,anon;
grant execute on function public.ifund_my_marketing_consent() to authenticated;
grant execute on function public.ifund_set_marketing_consent(boolean) to authenticated;
