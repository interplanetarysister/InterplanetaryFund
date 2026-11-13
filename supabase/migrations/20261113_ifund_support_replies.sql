-- Private two-way support conversations, preserving the existing support-ticket table.
create table if not exists public.ifund_support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null references public.ifund_support_ticket(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_role text not null check (author_role in ('member','super_admin')),
  body text not null check (char_length(body) between 2 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists idx_ifund_support_replies_ticket_created on public.ifund_support_replies(ticket_id,created_at);
alter table public.ifund_support_replies enable row level security;
revoke all on public.ifund_support_replies from public,anon,authenticated;

create or replace function public.ifund_add_support_reply(p_ticket_id text,p_message text)
returns table(reply_id uuid,posted_at timestamptz)
language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare
 v_uid uuid:=auth.uid();
 v_owner text;
 v_status text;
 v_admin boolean:=false;
 v_reply uuid;
begin
 if v_uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_ticket_id is null or char_length(p_ticket_id)>128
    or p_message is null or char_length(btrim(p_message)) not between 2 and 4000 then
   raise exception 'Invalid support reply' using errcode='22023';
 end if;
 v_admin:=coalesce(public.ifund_current_user_is_verified_super_admin(),false);
 select t.user_id,t.status into v_owner,v_status
   from public.ifund_support_ticket t where t.id=p_ticket_id for update;
 if v_owner is null or (v_owner<>v_uid::text and not v_admin) then
   raise exception 'Support ticket unavailable' using errcode='42501';
 end if;
 if v_status<>'open' then raise exception 'Ticket is closed' using errcode='22023'; end if;
 if not v_admin and (
   not exists(select 1 from auth.users u where u.id=v_uid and u.is_anonymous is false and u.email_confirmed_at is not null)
   or not coalesce(public.ifund_current_account_is_active(),false)
 ) then raise exception 'Confirmed active email account required' using errcode='42501'; end if;
 if (select count(*) from public.ifund_support_replies r
       where r.ticket_id=p_ticket_id and r.author_id=v_uid and r.created_at>now()-interval '1 hour')>=10 then
   raise exception 'Too many replies; please try later' using errcode='22023';
 end if;
 insert into public.ifund_support_replies(ticket_id,author_id,author_role,body)
 values (p_ticket_id,v_uid,case when v_admin then 'super_admin' else 'member' end,btrim(p_message))
 returning id into v_reply;
 if v_admin and v_owner ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id)
   values(v_owner::uuid,'Support reply received','There is a reply to your support request.','system','/support','support:reply:'||v_reply::text);
 end if;
 return query select r.id,r.created_at from public.ifund_support_replies r where r.id=v_reply;
end
$$;

create or replace function public.ifund_support_ticket_replies(p_ticket_id text)
returns table(reply_id uuid,author_role text,reply_body text,posted_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_uid uuid:=auth.uid();v_owner text;
begin
 if v_uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select t.user_id into v_owner from public.ifund_support_ticket t where t.id=p_ticket_id;
 if v_owner is null or (v_owner<>v_uid::text and not coalesce(public.ifund_current_user_is_verified_super_admin(),false)) then
   raise exception 'Support ticket unavailable' using errcode='42501';
 end if;
 return query select r.id,r.author_role,r.body,r.created_at
   from public.ifund_support_replies r where r.ticket_id=p_ticket_id order by r.created_at asc limit 100;
end
$$;
revoke all on function public.ifund_add_support_reply(text,text) from public,anon;
revoke all on function public.ifund_support_ticket_replies(text) from public,anon;
grant execute on function public.ifund_add_support_reply(text,text) to authenticated;
grant execute on function public.ifund_support_ticket_replies(text) to authenticated;
