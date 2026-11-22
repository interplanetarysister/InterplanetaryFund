select cron.schedule(
 'ifund-training-worker',
 '*/5 * * * *',
 (select command from cron.job where jobname='ifund-training-worker' limit 1)
);