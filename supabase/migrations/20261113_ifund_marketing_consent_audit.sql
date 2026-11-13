-- Immutable audit history of explicit marketing consent selections.
-- Legacy email update preferences are not interpreted as marketing consent.
create table if not exists public.ifund_marketing_consent_audit (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  previous_opt_in boolean,
  new_opt_in boolean not null,
  source text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_ifund_marketing_consent_audit_owner_time
  on public.ifund_marketing_consent_audit(owner_id,occurred_at desc);
alter table public.ifund_marketing_consent_audit enable row level security;
revoke all on public.ifund_marketing_consent_audit from public,anon,authenticated;
create or replace function public.ifund_audit_marketing_consent_change()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if tg_op='INSERT' or (tg_op='UPDATE' and old.outreach_opt_in is distinct from new.outreach_opt_in) then
    insert into public.ifund_marketing_consent_audit(owner_id,previous_opt_in,new_opt_in,source)
    values(new.owner_id,case when tg_op='UPDATE' then old.outreach_opt_in else null end,
           new.outreach_opt_in,new.source);
  end if;
  return new;
end
$$;
revoke all on function public.ifund_audit_marketing_consent_change() from public,anon,authenticated;
drop trigger if exists ifund_marketing_consent_audit_trg on public.ifund_marketing_consent;
create trigger ifund_marketing_consent_audit_trg
  after insert or update of outreach_opt_in on public.ifund_marketing_consent
  for each row execute function public.ifund_audit_marketing_consent_change();
