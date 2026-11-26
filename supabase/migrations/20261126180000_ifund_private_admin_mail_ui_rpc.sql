-- Route owner-authorized iFund business mail to the Mail UI without exposing its backing table.
-- Project ssibsfmtodgximseeqsv. Applied as migration 20261126.
-- Approved identities must already exist in public.ifund_admin_mail_access.
create or replace function public.ifund_admin_mail_list()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $fn$
declare actor uuid := auth.uid();
declare result jsonb;
begin
 if actor is null or not exists(select 1 from public.ifund_admin_mail_access where user_id=actor)
 then raise exception 'Not authorized for business mail' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.received_at desc),'[]'::jsonb)
 into result from (
   select id,recipient_address,sender_address,subject,body_text,received_at,
          is_read,delivery_status
   from public.admin_inbound_email order by received_at desc limit 50
 ) m;
 return result;
end $fn$;
revoke all on function public.ifund_admin_mail_list() from public,anon;
grant execute on function public.ifund_admin_mail_list() to authenticated;
create or replace function public.ifund_admin_mail_set_read(p_message uuid,p_read boolean default true)
returns boolean language plpgsql volatile security definer
set search_path=pg_catalog,public
as $fn$
declare actor uuid := auth.uid();
declare updated_count integer;
begin
 if actor is null or not exists(select 1 from public.ifund_admin_mail_access where user_id=actor)
 then raise exception 'Not authorized for business mail' using errcode='42501'; end if;
 update public.admin_inbound_email set is_read=coalesce(p_read,true) where id=p_message;
 get diagnostics updated_count=row_count;
 return updated_count=1;
end $fn$;
revoke all on function public.ifund_admin_mail_set_read(uuid,boolean) from public,anon;
grant execute on function public.ifund_admin_mail_set_read(uuid,boolean) to authenticated;
