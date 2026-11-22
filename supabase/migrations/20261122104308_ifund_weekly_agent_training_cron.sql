
do $$
declare v_url text := 'https://ssibsfmtodgximseeqsv.supabase.co/functions/v1/ifund-weekly-agent-training';
begin
 perform cron.schedule('ifund-training-weekly-start','0 10 * * 0',format($job$
 select net.http_post(
  url:=%L,
  headers:=jsonb_build_object('Content-Type','application/json','x-ifund-training-token',
   (select decrypted_secret from vault.decrypted_secrets where name='ifund_training_cron_token')),
  body:='{"action":"start"}'::jsonb,
  timeout_milliseconds:=15000
 );
 $job$,v_url));
 perform cron.schedule('ifund-training-worker','*/15 * * * *',format($job$
 select net.http_post(
  url:=%L,
  headers:=jsonb_build_object('Content-Type','application/json','x-ifund-training-token',
   (select decrypted_secret from vault.decrypted_secrets where name='ifund_training_cron_token')),
  body:='{"action":"work"}'::jsonb,
  timeout_milliseconds:=120000
 );
 $job$,v_url));
end $$;
