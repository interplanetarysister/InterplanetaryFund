-- The signing broker must verify the entire one-time receipt contract exists
-- before allowing the payment Worker to begin collecting real-money orders.
create or replace function public.ifund_premium_one_time_readiness()
returns jsonb language plpgsql stable security invoker
set search_path='' as $$
begin
 if current_user<>'service_role' then
   raise exception 'service role required' using errcode='42501'; end if;
 return jsonb_build_object('enabled',
   to_regclass('public.ifund_premium_one_time_purchases') is not null and
   to_regprocedure('public.ifund_premium_one_time_begin(uuid,text,text,text)') is not null and
   to_regprocedure('public.ifund_premium_one_time_finalize(uuid,text,text,text,timestamp with time zone,text)') is not null and
   to_regprocedure('public.ifund_premium_one_time_refund(text,text,text)') is not null,
   'version',1);
end $$;
revoke all on function public.ifund_premium_one_time_readiness()
 from public,anon,authenticated;
grant execute on function public.ifund_premium_one_time_readiness() to service_role;
