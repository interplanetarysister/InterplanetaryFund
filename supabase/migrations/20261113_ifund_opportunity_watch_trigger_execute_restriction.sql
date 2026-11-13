-- Production verified 2026-11-13: this SECURITY DEFINER notification hook is a trigger,
-- not a public API; no browser or anonymous role should execute it.
revoke all on function public.ifund_opportunity_watch_source_update() from public,anon,authenticated;
grant execute on function public.ifund_opportunity_watch_source_update() to service_role;
