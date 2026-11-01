
create table public.admin_inbound_email (
  id uuid primary key default gen_random_uuid(),
  recipient_address text not null,
  sender_address text not null,
  message_id text,
  subject text not null default '',
  body_text text not null default '',
  received_at timestamptz not null default now(),
  is_read boolean not null default false,
  priority text not null default 'normal',
  provider_id text,
  delivery_status text not null default 'received',
  created_at timestamptz not null default now(),
  constraint admin_inbound_email_delivery_status_check check (delivery_status in ('received','quarantined')),
  constraint admin_inbound_email_priority_check check (priority in ('normal','priority')),
  constraint admin_inbound_email_recipient_address_check check (
    lower(split_part(recipient_address,'@',2))='interplanetaryfund.com'
    and length(split_part(recipient_address,'@',1)) between 1 and 64
    and recipient_address not like '% %'
  )
);
create unique index admin_inbound_email_recipient_message_unique
  on public.admin_inbound_email (lower(recipient_address),message_id)
  where message_id is not null;
create index admin_inbound_email_unread_idx
  on public.admin_inbound_email (is_read,received_at desc);
create unique index admin_inbound_email_upsert_unique
  on public.admin_inbound_email (recipient_address,message_id);
alter table public.admin_inbound_email enable row level security;

create table public.ifund_admin_mail_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by text not null default 'owner_verified'
);
alter table public.ifund_admin_mail_access enable row level security;

create table public.ifund_admin_mail_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  message_id uuid,
  occurred_at timestamptz not null default now(),
  constraint ifund_admin_mail_audit_action_check check (action in ('list','mark_read','mark_unread'))
);
create index ifund_admin_mail_audit_actor_time
  on public.ifund_admin_mail_audit (actor_id,occurred_at desc);
alter table public.ifund_admin_mail_audit enable row level security;

grant usage on schema business_mail to service_role;
grant all on all tables in schema business_mail to service_role;
grant all on public.admin_inbound_email,public.ifund_admin_mail_access,public.ifund_admin_mail_audit to service_role;

create or replace function business_mail.receive_signed_member_message(
  p_to text,p_from text,p_subject text,p_body text,p_message_id text
) returns uuid
language plpgsql
security invoker
set search_path = 'pg_catalog','business_mail'
as $function$
declare
  m business_mail.mailboxes%rowtype;
  v_id uuid;
  bytes bigint;
  limit_bytes constant bigint := 104857600;
  overflow_bytes constant bigint := 10485760;
begin
  if p_to !~ '^[a-z0-9][a-z0-9._-]{0,62}@mail[.]interplanetaryfund[.]com$' then
    raise exception 'INVALID_RECIPIENT';
  end if;
  if length(p_from)>254 or length(p_message_id)>254 or length(p_subject)>240 or length(p_body)>12000 then
    raise exception 'INVALID_MESSAGE';
  end if;
  select b.* into m
  from business_mail.addresses a
  join business_mail.mailboxes b on b.id=a.mailbox_id
  where a.local_part||'@'||a.domain=p_to
    and a.status='active'
    and b.status in ('active','suspended')
    and b.entitlement_verified_at is not null
    and (b.paid_until>now() or b.grace_until>now())
  for update of b;
  if not found then raise exception 'INACTIVE_MAILBOX'; end if;
  select id into v_id from business_mail.messages
  where mailbox_id=m.id and provider_message_id=p_message_id;
  if v_id is not null then return v_id; end if;
  bytes := octet_length(coalesce(p_body,''))+octet_length(coalesce(p_subject,''))+
           octet_length(coalesce(p_from,''))+octet_length(p_to);
  if m.stored_bytes>=limit_bytes and
     (m.overflow_started_at is null or m.overflow_started_at+interval '7 days'<=now()) then
    raise exception 'MAILBOX_FULL';
  end if;
  if m.stored_bytes+bytes>limit_bytes+overflow_bytes then raise exception 'MAILBOX_FULL'; end if;
  insert into business_mail.messages(
    mailbox_id,provider_message_id,direction,envelope_from,envelope_to,subject,body_text,state,stored_bytes
  ) values (m.id,p_message_id,'incoming',p_from,p_to,p_subject,p_body,'received',bytes)
  returning id into v_id;
  update business_mail.mailboxes
  set stored_bytes=stored_bytes+bytes,
      overflow_started_at=case when stored_bytes+bytes>limit_bytes then coalesce(overflow_started_at,now()) else null end,
      updated_at=now()
  where id=m.id;
  return v_id;
end
$function$;

create or replace function public.ifund_receive_member_email(
  p_to text,p_from text,p_subject text,p_body text,p_message_id text
) returns uuid
language sql
security invoker
set search_path = 'pg_catalog','business_mail'
as $function$
  select business_mail.receive_signed_member_message(p_to,p_from,p_subject,p_body,p_message_id)
$function$;

create or replace function public.ifund_admin_mail_set_read_atomic(
  p_actor uuid,p_message uuid,p_read boolean
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare changed integer;
begin
  if (select auth.jwt()->>'role') is distinct from 'service_role' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if not exists(select 1 from public.ifund_admin_mail_access where user_id=p_actor) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  update public.admin_inbound_email set is_read=p_read where id=p_message;
  get diagnostics changed = row_count;
  if changed <> 1 then return false; end if;
  insert into public.ifund_admin_mail_audit(actor_id,action,message_id)
  values(p_actor,case when p_read then 'mark_read' else 'mark_unread' end,p_message);
  return true;
end
$function$;

revoke all on function business_mail.receive_signed_member_message(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ifund_receive_member_email(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ifund_admin_mail_set_read_atomic(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function business_mail.receive_signed_member_message(text,text,text,text,text) to service_role;
grant execute on function public.ifund_receive_member_email(text,text,text,text,text) to service_role;
grant execute on function public.ifund_admin_mail_set_read_atomic(uuid,uuid,boolean) to service_role;
