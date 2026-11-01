
create schema if not exists ifund_transfer;
create table if not exists ifund_transfer.owner_identity_map (
  source_owner_id text primary key,
  source_email text not null,
  source_auth_uid uuid,
  destination_auth_uid uuid references auth.users(id) on delete set null,
  verification_state text not null,
  candidate_auth_uid uuid references auth.users(id) on delete set null,
  candidate_match_method text,
  candidate_detected_at timestamptz,
  source_project_ref text not null default 'tzehxfikoslihnclhxuz',
  updated_at timestamptz not null default now(),
  constraint owner_identity_map_state_check check (verification_state in ('verified','awaiting_destination_login','conflict','revoked'))
);
create table if not exists ifund_transfer.source_auth_accounts (
  source_auth_uid uuid primary key,
  email text not null,
  email_confirmed_at timestamptz,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  last_sign_in_at timestamptz,
  identity_count integer not null default 0,
  destination_auth_uid uuid references auth.users(id) on delete set null,
  migration_state text not null,
  source_project_ref text not null default 'tzehxfikoslihnclhxuz',
  archived_at timestamptz not null default now(),
  constraint source_auth_accounts_state_check check (migration_state in ('mapped_to_destination','unconfirmed_source_account_not_recreated','needs_review'))
);
create table if not exists ifund_transfer.source_import_batches (
  batch_id uuid primary key,entity_type text not null,source_count integer not null,
  imported_count integer not null,source_digest text,status text not null,
  started_at timestamptz,verified_at timestamptz,
  source_project_ref text not null default 'tzehxfikoslihnclhxuz'
);
create table if not exists ifund_transfer.source_cutover_control (
  service text primary key,destination_verified boolean not null default false,
  source_frozen boolean not null default false,reconciliation_verified boolean not null default false,
  enabled boolean not null default false,updated_at timestamptz not null default now(),
  source_project_ref text not null default 'tzehxfikoslihnclhxuz'
);
create table if not exists ifund_transfer.source_routine_archive (
  source_schema text not null,routine_name text not null,identity_arguments text not null default '',
  definition text not null,security_definer boolean not null default false,grants text,
  source_project_ref text not null default 'tzehxfikoslihnclhxuz',
  archived_at timestamptz not null default now(),
  primary key(source_schema,routine_name,identity_arguments)
);
create table if not exists ifund_transfer.source_trigger_archive (
  source_schema text not null,table_name text not null,trigger_name text not null,
  action_timing text,event_manipulation text,action_statement text not null,
  source_project_ref text not null default 'tzehxfikoslihnclhxuz',
  archived_at timestamptz not null default now(),
  primary key(source_schema,table_name,trigger_name,event_manipulation)
);
alter table ifund_transfer.owner_identity_map enable row level security;
alter table ifund_transfer.source_auth_accounts enable row level security;
alter table ifund_transfer.source_import_batches enable row level security;
alter table ifund_transfer.source_cutover_control enable row level security;
alter table ifund_transfer.source_routine_archive enable row level security;
alter table ifund_transfer.source_trigger_archive enable row level security;
revoke all on ifund_transfer.owner_identity_map,ifund_transfer.source_auth_accounts,
  ifund_transfer.source_import_batches,ifund_transfer.source_cutover_control,
  ifund_transfer.source_routine_archive,ifund_transfer.source_trigger_archive from public,anon,authenticated;
grant usage on schema ifund_transfer to service_role;
grant all on ifund_transfer.owner_identity_map,ifund_transfer.source_auth_accounts,
  ifund_transfer.source_import_batches,ifund_transfer.source_cutover_control,
  ifund_transfer.source_routine_archive,ifund_transfer.source_trigger_archive to service_role;

insert into ifund_transfer.owner_identity_map(
 source_owner_id,source_email,source_auth_uid,destination_auth_uid,verification_state,
 candidate_auth_uid,candidate_match_method,candidate_detected_at,source_project_ref,updated_at
)
select s.source_payload->>'source_owner_id',s.source_payload->>'source_email',
 nullif(s.source_payload->>'destination_auth_uid','')::uuid,
 case when s.source_payload->>'verification_state'='verified' and a.email_confirmed_at is not null then a.id else null end,
 case when s.source_payload->>'verification_state'='verified' and a.email_confirmed_at is not null then 'verified' else 'awaiting_destination_login' end,
 case when s.source_payload->>'verification_state'='verified' and a.email_confirmed_at is not null then a.id else null end,
 case when s.source_payload->>'verification_state'='verified' and a.email_confirmed_at is not null then 'confirmed_exact_email' else null end,
 nullif(s.source_payload->>'candidate_detected_at','')::timestamptz,
 'tzehxfikoslihnclhxuz',coalesce(nullif(s.source_payload->>'updated_at','')::timestamptz,now())
from ifund_transfer.source_snapshots s
left join auth.users a on lower(a.email)=lower(s.source_payload->>'source_email')
where s.entity_type='ifund_migration.owner_identity_map'
on conflict(source_owner_id) do update set
 source_email=excluded.source_email,source_auth_uid=excluded.source_auth_uid,
 destination_auth_uid=excluded.destination_auth_uid,verification_state=excluded.verification_state,
 candidate_auth_uid=excluded.candidate_auth_uid,candidate_match_method=excluded.candidate_match_method,
 candidate_detected_at=excluded.candidate_detected_at,updated_at=excluded.updated_at;

update ifund_stage."user" u set owner_auth_uid=m.destination_auth_uid
from ifund_transfer.owner_identity_map m
where u.legacy_id=m.source_owner_id and m.verification_state='verified'
and m.destination_auth_uid is not null and u.owner_auth_uid is distinct from m.destination_auth_uid;

update ifund_stage.campaign c set owner_auth_uid=m.destination_auth_uid
from ifund_transfer.campaign_snapshots cs
join ifund_transfer.owner_identity_map m on m.source_owner_id=cs.source_payload->>'source_owner_id'
where c.legacy_id=cs.source_id and m.verification_state='verified'
and m.destination_auth_uid is not null and c.owner_auth_uid is distinct from m.destination_auth_uid;

update ifund_stage.blog_entry b set owner_auth_uid=m.destination_auth_uid
from ifund_transfer.owner_identity_map m
where b.owner_user_id=m.source_owner_id and m.verification_state='verified'
and m.destination_auth_uid is not null and b.owner_auth_uid is distinct from m.destination_auth_uid;

update ifund_stage.notification n set owner_auth_uid=m.destination_auth_uid
from ifund_transfer.owner_identity_map m
where n.user_id=m.source_owner_id and m.verification_state='verified'
and m.destination_auth_uid is not null and n.owner_auth_uid is distinct from m.destination_auth_uid;

update ifund_stage.user_blog b set owner_auth_uid=m.destination_auth_uid
from ifund_transfer.owner_identity_map m
where b.owner_user_id=m.source_owner_id and m.verification_state='verified'
and m.destination_auth_uid is not null and b.owner_auth_uid is distinct from m.destination_auth_uid;
