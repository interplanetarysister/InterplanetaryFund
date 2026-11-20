-- Preserve idempotent receipt replay even if retry occurs after a deadline.
create or replace function public.ifund_schedule_inapp_reminder(
  p_request_id uuid, p_title text, p_body text, p_due_at timestamptz
)
returns table(reminder_id uuid, reminder_status text, scheduled_for timestamptz)
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare
  v_owner uuid:=auth.uid();
  v_now timestamptz:=pg_catalog.clock_timestamp();
  v_title text:=btrim(p_title);
  v_body text:=btrim(p_body);
  v_existing public.ifund_inapp_reminder_queue%rowtype;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
     or not coalesce(public.ifund_current_user_has_current_terms(),false)
     or not exists (
       select 1 from auth.users u where u.id=v_owner
         and u.is_anonymous is false and u.email_confirmed_at is not null
     )
  then raise exception 'Verified active account and current terms required' using errcode='42501';end if;
  if p_request_id is null or p_title is null or p_body is null or p_due_at is null
     or char_length(v_title) not between 4 and 100
     or char_length(v_body) not between 8 and 1000
  then raise exception 'Provide a valid title, message and due time'
     using errcode='22023';end if;

  perform pg_catalog.pg_advisory_xact_lock(19019, pg_catalog.hashtext(v_owner::text));
  select q.* into v_existing from public.ifund_inapp_reminder_queue q
   where q.id=p_request_id;
  if found then
    if v_existing.owner_id<>v_owner or v_existing.title<>v_title
      or v_existing.body<>v_body or v_existing.due_at<>p_due_at
    then raise exception 'Request ID already used for different reminder' using errcode='22023';end if;
    return query select v_existing.id,v_existing.status,v_existing.due_at;
    return;
  end if;
  -- Retrying an existing identical idempotency key must work even after due time.
  if p_due_at < v_now + interval '1 minute' or p_due_at > v_now + interval '30 days'
  then raise exception 'Choose a due time between 1 minute and 30 days ahead'
    using errcode='22023';end if;
  if (select count(*) from public.ifund_inapp_reminder_queue q
      where q.owner_id=v_owner and q.created_at>=v_now-interval '24 hours')>=10
  then raise exception 'Limit of ten reminders per rolling day reached' using errcode='22023';end if;
  if (select count(*) from public.ifund_inapp_reminder_queue q
      where q.owner_id=v_owner and q.status='queued')>=20
  then raise exception 'Limit of twenty pending reminders reached' using errcode='22023';end if;
  insert into public.ifund_inapp_reminder_queue
    (id,owner_id,title,body,due_at,next_attempt_at)
    values(p_request_id,v_owner,v_title,v_body,p_due_at,p_due_at);
  return query select p_request_id,'queued'::text,p_due_at;
end;
$$;
revoke all on function public.ifund_schedule_inapp_reminder(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ifund_schedule_inapp_reminder(uuid,text,text,timestamptz) to authenticated;
