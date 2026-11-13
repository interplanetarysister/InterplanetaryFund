-- IFund NEXUS: one built-in Supabase pg_cron dispatch per day, no paid
-- external scheduler. Only opt-in members with due preferences receive an
-- in-app notification. Bound throughput to 100; skipped due work persists.
-- Do not include tokens or remote HTTP calls in cron command.
do $nexus_cron$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') and
    not exists(select 1 from cron.job where jobname='ifund-nexus-daily-briefs') then
   perform cron.schedule(
     'ifund-nexus-daily-briefs',
     '0 15 * * *',
     'select public.ifund_dispatch_nexus_briefs(100)'
   );
 end if;
end $nexus_cron$;
