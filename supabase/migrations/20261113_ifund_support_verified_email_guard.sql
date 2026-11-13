-- Harden ticket intake even when clients bypass the guarded frontend.
create or replace function public.ifund_create_support_ticket(p_subject text, p_message text)
returns table(ticket_id text, ticket_status text, submitted_at timestamptz)
language plpgsql volatile security definer
set search_path = '' set row_security = 'off'
as $$
declare v_uid uuid := auth.uid(); v_id text;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode='42501';
  end if;
  -- API callers can bypass the MemberAccess UI; verify identity on the server.
  if not exists (
    select 1 from auth.users u where u.id=v_uid
      and u.is_anonymous is false and u.email_confirmed_at is not null
  ) or not coalesce(public.ifund_current_account_is_active(), false) then
    raise exception 'Confirmed active email account required' using errcode='42501';
  end if;
  if p_subject is null or char_length(btrim(p_subject)) not between 4 and 160
     or p_message is null or char_length(btrim(p_message)) not between 10 and 4000 then
    raise exception 'Subject or message length is invalid' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(29461, pg_catalog.hashtext(v_uid::text));
  if (select count(*) from public.ifund_support_ticket t
      where t.user_id=v_uid::text and t.created_at > now()-interval '1 hour') >= 3 then
    raise exception 'Too many support requests; please try later' using errcode='22023';
  end if;
  v_id := gen_random_uuid()::text;
  insert into public.ifund_support_ticket
    (id,user_id,created_by_id,subject,message,status,created_at,updated_at)
  values (v_id,v_uid::text,v_uid::text,btrim(p_subject),btrim(p_message),'open',now(),now());
  return query select t.id,t.status,t.created_at from public.ifund_support_ticket t where t.id=v_id;
end
$$;

