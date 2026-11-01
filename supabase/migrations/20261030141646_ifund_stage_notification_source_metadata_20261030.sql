
begin;

do $preflight$
begin
  if to_regclass('ifund_stage.notification') is null then
    raise exception 'Expected private IFund notification staging table is missing.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='ifund_stage' and table_name='notification' and column_name='legacy_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='ifund_stage' and table_name='notification' and column_name='owner_auth_uid'
  ) then
    raise exception 'Private notification staging table differs from the audited schema.';
  end if;
  if exists (select 1 from ifund_stage.notification) then
    raise exception 'Private notification staging table is no longer empty; stop for reconciliation.';
  end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='ifund_stage' and c.relname='notification'
      and c.relrowsecurity is true
  ) then
    raise exception 'Private notification staging table must retain RLS.';
  end if;
end
$preflight$;

alter table ifund_stage.notification
  add column if not exists source_created_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_created_by_id text,
  add column if not exists source_is_sample boolean,
  add column if not exists source_digest_sha256 text;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='ifund_stage.notification'::regclass
      and conname='notification_source_digest_sha256_check'
  ) then
    alter table ifund_stage.notification
      add constraint notification_source_digest_sha256_check
      check (source_digest_sha256 is null or source_digest_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end
$constraints$;

-- Private staging only. No public schema, Auth identity, RLS policy, or
-- payment/ledger table is modified by this migration.
commit;
