-- Authenticated support requests using the existing migrated ticket table.
-- Keep table RLS deny-by-default; expose only owner/admin scoped RPCs.
create index if not exists idx_ifund_support_ticket_owner_created
  on public.ifund_support_ticket (user_id, created_at desc);

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

create or replace function public.ifund_my_support_tickets()
returns table(ticket_id text,subject text,message text,ticket_status text,submitted_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer
set search_path = '' set row_security = 'off'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
  return query
    select t.id,t.subject,t.message,t.status,t.created_at,t.updated_at
    from public.ifund_support_ticket t
    where t.user_id=v_uid::text
    order by t.created_at desc limit 50;
end
$$;

create or replace function public.ifund_super_admin_support_queue()
returns table(ticket_id text,owner_id text,subject text,message text,ticket_status text,submitted_at timestamptz)
language plpgsql stable security definer
set search_path = '' set row_security = 'off'
as $$
begin
  if auth.uid() is null or not coalesce(public.ifund_current_user_is_verified_super_admin(), false) then
    raise exception 'Verified super administrator only' using errcode='42501';
  end if;
  return query
    select t.id,t.user_id,t.subject,t.message,t.status,t.created_at
    from public.ifund_support_ticket t
    order by case when t.status='open' then 0 else 1 end,t.created_at desc limit 100;
end
$$;

create or replace function public.ifund_super_admin_close_support_ticket(p_ticket_id text)
returns boolean
language plpgsql volatile security definer
set search_path = '' set row_security = 'off'
as $$
declare v_changed bigint;
begin
  if auth.uid() is null or not coalesce(public.ifund_current_user_is_verified_super_admin(), false) then
    raise exception 'Verified super administrator only' using errcode='42501';
  end if;
  if p_ticket_id is null or char_length(p_ticket_id)>128 then
    raise exception 'Invalid ticket identifier' using errcode='22023';
  end if;
  update public.ifund_support_ticket t
  set status='closed',updated_at=now()
  where t.id=p_ticket_id and t.status='open';
  get diagnostics v_changed = row_count;
  return v_changed=1;
end
$$;

revoke all on function public.ifund_create_support_ticket(text,text) from public,anon;
revoke all on function public.ifund_my_support_tickets() from public,anon;
revoke all on function public.ifund_super_admin_support_queue() from public,anon;
revoke all on function public.ifund_super_admin_close_support_ticket(text) from public,anon;
grant execute on function public.ifund_create_support_ticket(text,text) to authenticated;
grant execute on function public.ifund_my_support_tickets() to authenticated;
grant execute on function public.ifund_super_admin_support_queue() to authenticated;
grant execute on function public.ifund_super_admin_close_support_ticket(text) to authenticated;
