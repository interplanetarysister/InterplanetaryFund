-- Disaster-watch polling: every 10 minutes, call the ifund-disaster-watch
-- edge function with the vault-stored cron token. Same pg_cron /
-- net.http_post pattern as the weekly agent-training cron migration
-- (20261122104308), pointed at the disaster-watch function.
--
-- The pg_cron call is guarded so this migration also applies in PGlite
-- (which has no pg_cron): the net.http_post call itself only ever runs as
-- the scheduled job's command string on hosted Supabase, never at
-- migration time.
do $disaster_cron$
declare
  v_url text := 'https://ssibsfmtodgximseeqsv.supabase.co/functions/v1/ifund-disaster-watch';
  v_has_cron boolean;
begin
  -- Nested checks, not one AND: the cron.job reference is only planned
  -- when pg_cron actually exists. A single `exists(pg_cron) AND NOT
  -- EXISTS(cron.job)` condition fails in PGlite because the planner
  -- resolves cron.job before the first condition short-circuits.
  select exists(select 1 from pg_extension where extname = 'pg_cron') into v_has_cron;
  if v_has_cron then
    if not exists(select 1 from cron.job where jobname = 'ifund-disaster-watch') then
      perform cron.schedule('ifund-disaster-watch', '*/10 * * * *', format($job$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-ifund-disaster-token',
            (select decrypted_secret from vault.decrypted_secrets where name = 'ifund_disaster_cron_token')),
          body := '{}'::jsonb,
          timeout_milliseconds := 15000
        );
      $job$, v_url));
    end if;
  end if;
end $disaster_cron$;
