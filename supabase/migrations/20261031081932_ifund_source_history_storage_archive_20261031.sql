
create table if not exists ifund_transfer.source_migration_history (
  version text primary key,
  name text not null,
  source_project_ref text not null default 'tzehxfikoslihnclhxuz',
  archived_at timestamptz not null default now()
);
create table if not exists ifund_transfer.source_storage_inventory (
  item_type text not null,
  item_key text not null,
  record jsonb not null,
  source_project_ref text not null default 'tzehxfikoslihnclhxuz',
  archived_at timestamptz not null default now(),
  primary key(item_type,item_key)
);
alter table ifund_transfer.source_migration_history enable row level security;
alter table ifund_transfer.source_storage_inventory enable row level security;
revoke all on ifund_transfer.source_migration_history,ifund_transfer.source_storage_inventory from public,anon,authenticated;
grant all on ifund_transfer.source_migration_history,ifund_transfer.source_storage_inventory to service_role;
