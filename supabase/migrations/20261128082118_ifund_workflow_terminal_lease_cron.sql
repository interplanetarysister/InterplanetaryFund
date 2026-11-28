-- Terminal cleanup is database-local, with no external request or replay.
select cron.schedule('ifund-workflow-terminal-lease-recovery','3-58/5 * * * *','select ifund_ops.sweep_exhausted_workflow_jobs(25)');
