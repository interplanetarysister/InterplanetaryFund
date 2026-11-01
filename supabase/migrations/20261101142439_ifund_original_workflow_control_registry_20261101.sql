create schema if not exists ifund_control;
create table if not exists ifund_control.workflow_registry (
 source_id text primary key,
 name text not null,
 trigger_kind text not null,
 original_cron text,
 source_status text not null,
 migration_status text not null default 'inventory_only' check (migration_status in ('inventory_only','implemented','verified')),
 execution_enabled boolean not null default false,
 target_handler text,
 updated_at timestamptz not null default now()
);
alter table ifund_control.workflow_registry enable row level security;
revoke all on ifund_control.workflow_registry from anon,authenticated;
insert into ifund_control.workflow_registry(source_id,name,trigger_kind,original_cron,source_status) values
('6ac9c3704cd253e3b6c4baf6','IFund Reporter Daily Diary','scheduled','30 17 * * *', 'inactive'),
('6ac9bbe3ccd8293e84349b62','IFund Official Social Editor','scheduled','0 */4 * * *', 'inactive'),
('6ac9bafda10e147b29a4e72b','Weekly Writing Psychology & Social Trends Training','scheduled','0 16 * * *', 'inactive'),
('6ab446399b180129557a306a','Future Workflow Registry','entity','', 'inactive'),
('6ab445e6f784c7aa60a131cf','Integration Health Check','scheduled','30 */6 * * *', 'inactive'),
('6ab445d712ec5013ebff9328','External Fund Sync','scheduled','15 3 * * *', 'inactive'),
('6ab41ae5f6b7e2a094a0c274','Admin Action Conversation Router','scheduled','*/15 * * * *', 'inactive'),
('6ab4170cc6b27ba8a9eadd53','Platform Account Steward','scheduled','30 15 * * *', 'inactive'),
('6ab2e793646413d5557ea201','PayPal Holding Settlement Reconciliation','scheduled','0 * * * *', 'inactive'),
('6ab1a08108d4a9be3dfd4db9','External Feed Mirroring','scheduled','0 * * * *', 'inactive'),
('6ab1a08108d4a9be3dfd4db6','Social Media Autopilot','scheduled','0 14 * * *', 'inactive'),
('6a96fe327439d6ce0ccd52d4','Feature Discovery on Completion','entity','', 'active'),
('6a96fd316b99c1b6d4a5edeb','Campaign Sync on Create','entity','', 'inactive'),
('6a96fd316b99c1b6d4a5ede9','Campaign Sync on Update','entity','', 'active'),
('6a96fd316b99c1b6d4a5ede6','Volunteer Welcome Follow-up','entity','', 'active'),
('6a96fd316b99c1b6d4a5ede4','Grant Application Review','entity','', 'active'),
('6a6d9f9caafcff94608be9a3','Campaign Protocol','entity','', 'inactive'),
('6a6cfeba1eb94d299d05450b','Connection Sync Engine','scheduled','0 * * * *', 'inactive'),
('6a6c2e8cc4e17b42d4cadfa8','AI Outreach Agent','scheduled','0 */6 * * *', 'inactive')
on conflict (source_id) do update set name=excluded.name,trigger_kind=excluded.trigger_kind,original_cron=excluded.original_cron,source_status=excluded.source_status,updated_at=now();
