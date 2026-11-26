-- Read-only operational receipts for the verified iFund admin interface.
-- The private bot credential and its hash never leave ifund_private. A client
-- cannot activate the bot or create a run by calling this RPC.
begin;
create or replace function public.ifund_ops_bot_admin_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  latest jsonb;
  used integer;
  online boolean;
begin
  if coalesce(public.ifund_current_user_is_verified_admin(),false) is distinct from true then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  select c.enabled into online from ifund_private.ifund_ops_bot_control c where c.singleton=true;
  select count(*)::integer into used from ifund_private.ifund_ops_bot_runs r
    where r.created_at>=date_trunc('day',now());
  select jsonb_build_object(
    'state',r.status,
    'created_at',r.created_at,
    'finished_at',r.finished_at
  ) into latest
  from ifund_private.ifund_ops_bot_runs r
  order by r.created_at desc,r.id desc limit 1;
  return jsonb_build_object(
    'configured',coalesce(online,false),
    'utc_day_used',used,
    'utc_day_limit',8,
    'latest',latest
  );
end $$;
revoke all on function public.ifund_ops_bot_admin_status() from public,anon,authenticated;
grant execute on function public.ifund_ops_bot_admin_status() to authenticated;
commit;
