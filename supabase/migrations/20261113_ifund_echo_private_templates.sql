-- ECHO private reusable message templates. Stage until owner-authorized build;
-- never send messages or grant contact permissions by saving a template.
create table if not exists public.ifund_communications_templates (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 label text not null check (char_length(label) between 4 and 80),
 body text not null check (char_length(body) between 15 and 3000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ifund_communications_templates_owner_idx
  on public.ifund_communications_templates(owner_id,updated_at desc);
alter table public.ifund_communications_templates enable row level security;
revoke all on public.ifund_communications_templates from public,anon,authenticated;

create or replace function public.ifund_my_message_templates()
returns table(template_id uuid,label text,body text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active account required' using errcode='42501'; end if;
 return query select t.id,t.label,t.body,t.updated_at from public.ifund_communications_templates t
 where t.owner_id=v_owner order by t.updated_at desc limit 20;
end $$;

create or replace function public.ifund_save_message_template(p_label text,p_body text)
returns uuid language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();v_id uuid;
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
    and u.email_confirmed_at is not null and u.is_anonymous is false)
 then raise exception 'Confirmed active account required' using errcode='42501'; end if;
 if p_label is null or char_length(btrim(p_label)) not between 4 and 80
   or p_body is null or char_length(btrim(p_body)) not between 15 and 3000
 then raise exception 'Template label or body length invalid' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(29564,pg_catalog.hashtext(v_owner::text));
 if (select count(*) from public.ifund_communications_templates t where t.owner_id=v_owner)>=20
 then raise exception 'Template limit reached' using errcode='22023'; end if;
 insert into public.ifund_communications_templates(owner_id,label,body)
 values(v_owner,btrim(p_label),btrim(p_body))
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.ifund_delete_message_template(p_template_id uuid)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare v_count int;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 delete from public.ifund_communications_templates t where t.id=p_template_id and t.owner_id=auth.uid();
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;
revoke all on function public.ifund_my_message_templates() from public,anon;
revoke all on function public.ifund_save_message_template(text,text) from public,anon;
revoke all on function public.ifund_delete_message_template(uuid) from public,anon;
grant execute on function public.ifund_my_message_templates() to authenticated;
grant execute on function public.ifund_save_message_template(text,text) to authenticated;
grant execute on function public.ifund_delete_message_template(uuid) to authenticated;
