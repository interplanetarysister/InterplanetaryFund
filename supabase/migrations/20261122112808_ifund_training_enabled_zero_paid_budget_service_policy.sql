
create or replace function public.ifund_training_policy()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'enabled',enabled,
  'allow_paid_requests',allow_paid_requests,
  'budget_usd',budget_usd,
  'max_attempts',max_attempts
 ) from ifund_training.settings where singleton=true;
$$;
revoke all on function public.ifund_training_policy() from public,anon,authenticated;
grant execute on function public.ifund_training_policy() to service_role;
update ifund_training.settings
set enabled=true,allow_paid_requests=false,budget_usd=0,updated_at=now()
where singleton=true;
