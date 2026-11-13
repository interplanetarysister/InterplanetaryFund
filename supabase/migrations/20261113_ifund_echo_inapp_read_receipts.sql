-- Private owner-only ECHO engagement receipt counts.
-- A notification marked read indicates in-app acknowledgment only,
-- not email delivery, provider delivery, engagement or a human reply.
create or replace function public.ifund_my_echo_delivery_read_receipts()
returns table (
  delivery_id uuid,
  campaign_id uuid,
  notifications_recorded integer,
  notifications_stored bigint,
  notifications_marked_read bigint,
  created_at timestamptz
)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
     and u.is_anonymous is false and u.email_confirmed_at is not null) then
    raise exception 'Confirmed active owner required' using errcode='42501';
  end if;
  return query
    select d.id,d.campaign_id,d.recipient_count,
      (select count(*) from public.ifund_notifications n
         where n.canonical_operation_id like ('echo:inapp:'||d.id::text||':%')
           and n.type='announcement'),
      (select count(*) from public.ifund_notifications n
         where n.canonical_operation_id like ('echo:inapp:'||d.id::text||':%')
           and n.type='announcement' and n.read is true),
      d.created_at
    from public.ifund_echo_inapp_deliveries d where d.owner_id=v_owner
    order by d.created_at desc limit 100;
end
$$;
revoke all on function public.ifund_my_echo_delivery_read_receipts() from public,anon;
grant execute on function public.ifund_my_echo_delivery_read_receipts() to authenticated;
