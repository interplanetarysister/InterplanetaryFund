-- Database-local owner deadline notices need no Cloudflare secret or extra trigger.
select cron.schedule('ifund-watched-opportunity-deadlines','10 * * * *','select ifund_ops.dispatch_watched_opportunity_deadlines(25)');
