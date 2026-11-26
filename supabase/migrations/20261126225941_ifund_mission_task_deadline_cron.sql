-- Schedule only the bounded, database-local Mission reminder dispatcher.
select cron.schedule('ifund-mission-task-deadlines','20 * * * *','select ifund_ops.dispatch_mission_task_deadlines(25)');
