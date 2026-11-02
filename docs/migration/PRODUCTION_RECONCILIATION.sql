-- PRODUCTION RECONCILIATION REPORT — READ ONLY
-- ===========================================================================
-- Project: ssibsfmtodgximseeqsv (InterplanetaryFund)
-- Purpose: report the exact current shape of every object that PR #186 touches,
--          BEFORE any pending migration is applied.
--
-- WHY THIS EXISTS
-- The pending migrations create tables with `create table if not exists` and
-- then grant column-level privileges, e.g. `grant update(read) on
-- public.ifund_notifications`. Against a database that already contains a table
-- of that name, `if not exists` does NOT verify anything: it silently does
-- nothing, and the following statements either fail on a missing column or —
-- worse — succeed while the application reads a column the table does not have.
-- `create table if not exists` cannot detect a schema that already exists but
-- disagrees with the migration.
--
-- A second risk: this repository names its tables `ifund_*`. If production was
-- built by a different path and names them `campaigns`/`profiles`/etc., the
-- migration would create a parallel set of empty tables and the application
-- would read the wrong ones. Query 1 answers this.
--
-- HOW TO RUN
-- Paste this entire file into the Supabase SQL editor for ssibsfmtodgximseeqsv
-- and run it. It contains only SELECT statements against system catalogs. It
-- writes nothing, changes nothing, and takes no locks beyond catalog reads.
--
-- The result is one row per finding. Copy the whole output back verbatim.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Which of the tables PR #186 depends on actually exist, and under what name?
--    'expected' means this repository creates it. Anything reported absent that
--    the application queries will fail closed at runtime.
-- ---------------------------------------------------------------------------
with expected(name) as (
  values
    ('ifund_profiles'), ('ifund_campaigns'), ('ifund_posts'), ('ifund_connections'),
    ('ifund_blogs'), ('ifund_blog_entries'), ('ifund_legal_acceptances'),
    ('ifund_notifications'), ('ifund_inbox_items'), ('ifund_follows'),
    ('ifund_official_publications')
)
select
  '1. TABLE PRESENCE' as report,
  e.name as object,
  case when t.table_name is null then 'ABSENT' else 'present' end as state,
  coalesce(t.table_type, '-') as detail
from expected e
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = e.name
order by state desc, e.name;

-- ---------------------------------------------------------------------------
-- 1b. Any *other* public table whose name suggests it holds the same data.
--     If these exist alongside the ifund_* names, we have a duplicate-schema
--     problem and must not create a third copy.
-- ---------------------------------------------------------------------------
select
  '1b. SIMILAR NAMES' as report,
  table_name as object,
  (select count(*) from information_schema.columns c
    where c.table_schema = t.table_schema and c.table_name = t.table_name) as column_count
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and t.table_name !~ '^ifund_'
order by table_name;

-- ---------------------------------------------------------------------------
-- 2. Exact columns of every table PR #186 touches, in ordinal order.
--    Compare this against the CREATE TABLE blocks in the pending migration.
--    Any column the migration grants but this list lacks will make it fail.
-- ---------------------------------------------------------------------------
select
  '2. COLUMNS' as report,
  table_name as object,
  ordinal_position as pos,
  column_name,
  data_type as type,
  is_nullable as nullable,
  coalesce(column_default, '-') as default_value
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'ifund_profiles','ifund_campaigns','ifund_posts','ifund_connections',
    'ifund_blogs','ifund_blog_entries','ifund_legal_acceptances',
    'ifund_notifications','ifund_inbox_items','ifund_follows',
    'ifund_official_publications')
order by table_name, ordinal_position;

-- ---------------------------------------------------------------------------
-- 3. Row Level Security: enabled, and forced?
--    rowsecurity = false on a table holding member data is a finding.
-- ---------------------------------------------------------------------------
select
  '3. RLS ENABLED' as report,
  tablename as object,
  rowsecurity as rls_enabled,
  case when rowsecurity then 'ok' else 'FINDING: RLS disabled' end as note
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;

-- ---------------------------------------------------------------------------
-- 4. Every existing policy, with its full expression.
--    The B20 defect was a policy whose USING/WITH CHECK compared a self-declared
--    column instead of the real owning row. This output is what lets that class
--    of defect be checked against live state rather than against source.
-- ---------------------------------------------------------------------------
select
  '4. POLICIES' as report,
  tablename as object,
  policyname as policy,
  cmd as command,
  array_to_string(roles, ',') as roles,
  coalesce(qual, '-') as using_expression,
  coalesce(with_check, '-') as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- 5. Table-level privileges held by the browser-facing roles.
--    anon/authenticated must never hold INSERT/UPDATE/DELETE on member data
--    except where a policy and a grant deliberately allow it.
-- ---------------------------------------------------------------------------
select
  '5. TABLE GRANTS' as report,
  table_name as object,
  grantee,
  privilege_type as privilege
from information_schema.table_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;

-- ---------------------------------------------------------------------------
-- 6. Column-level privileges. This is what the pending migration's
--    `grant update(read)` style statements depend on. A column named here that
--    the table does not have is a hard failure.
-- ---------------------------------------------------------------------------
select
  '6. COLUMN GRANTS' as report,
  table_name as object,
  column_name,
  grantee,
  privilege_type as privilege
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, column_name;

-- ---------------------------------------------------------------------------
-- 7. Functions, with the properties the Supabase security advisor reviews.
--    A SECURITY DEFINER function without a pinned search_path is the classic
--    privilege-escalation finding: it runs with the owner's rights and resolves
--    unqualified names through a caller-influenced path. proconfig shows whether
--    `search_path` is pinned. EXECUTE grants show who can call it.
-- ---------------------------------------------------------------------------
select
  '7. FUNCTIONS' as report,
  n.nspname as schema,
  p.proname as function,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case when p.prosecdef then 'SECURITY DEFINER' else 'security invoker' end as security,
  coalesce(array_to_string(p.proconfig, ' | '), 'NO search_path PINNED') as config,
  case
    when p.prosecdef and (p.proconfig is null or not exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
      where c like 'search\_path=%')) then 'FINDING: definer without pinned search_path'
    else 'ok'
  end as note
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'ifund_ops')
order by note desc, n.nspname, p.proname;

-- ---------------------------------------------------------------------------
-- 7b. Who may EXECUTE those functions.
-- ---------------------------------------------------------------------------
select
  '7b. FUNCTION EXECUTE' as report,
  routine_schema as schema,
  routine_name as function,
  grantee,
  privilege_type as privilege
from information_schema.routine_privileges
where routine_schema in ('public', 'ifund_ops')
  and grantee in ('anon', 'authenticated', 'public')
order by routine_schema, routine_name, grantee;

-- ---------------------------------------------------------------------------
-- 8. Constraints, to detect a primary key or unique constraint that differs
--    from the migration's assumption. A different PK shape changes upsert
--    behaviour silently.
-- ---------------------------------------------------------------------------
select
  '8. CONSTRAINTS' as report,
  c.conrelid::regclass::text as tbl,
  c.conname as constraint_name,
  case c.contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE'
       when 'f' then 'FOREIGN KEY' when 'c' then 'CHECK' else c.contype::text end as kind,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.connamespace = 'public'::regnamespace
  and c.contype in ('p', 'u', 'f', 'c')
order by tbl, kind, constraint_name;

-- ---------------------------------------------------------------------------
-- 9. Triggers on the affected tables.
-- ---------------------------------------------------------------------------
select
  '9. TRIGGERS' as report,
  event_object_table as object,
  trigger_name,
  action_timing || ' ' || string_agg(event_manipulation, ' OR ') as fires
from information_schema.triggers
where trigger_schema = 'public'
group by event_object_table, trigger_name, action_timing
order by event_object_table, trigger_name;

-- ---------------------------------------------------------------------------
-- 10. Row counts. Answers "is there data to preserve" per table, which decides
--     whether any corrective action is reversible. Counts only; no row content.
-- ---------------------------------------------------------------------------
-- A direct `count(*)` on a table that does not exist aborts the whole report,
-- and "the table is absent" is one of the results we most need. Read the
-- catalog's row estimate instead: it touches no user table and cannot fail.
-- reltuples is -1 before the first analyze, so floor it at 0.
select
  '10. ROW COUNTS (approx)' as report,
  c.relname as tbl,
  greatest(c.reltuples, 0)::bigint as approx_rows,
  case when c.reltuples < 0 then 'never analyzed - treat as unknown' else '' end as note
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- ---------------------------------------------------------------------------
-- 11. Applied migration history, so the pending files can be placed correctly
--     and never re-run.
-- ---------------------------------------------------------------------------
-- Dynamic and guarded: a direct SELECT aborts the whole script when the history
-- table is not visible to the running role, which is common for a non-owner
-- role. Building the statement at run time keeps the report non-fatal, and the
-- rows are returned through a notice so nothing is lost.
do $$
declare
  r record;
  listing text := '';
  counted int := 0;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice '11. MIGRATION HISTORY: supabase_migrations.schema_migrations is ABSENT or not visible to this role';
    return;
  end if;
  for r in execute 'select version, name from supabase_migrations.schema_migrations order by version' loop
    counted := counted + 1;
    listing := listing || '   ' || r.version || '  ' || coalesce(r.name, '') || chr(10);
  end loop;
  raise notice '11. MIGRATION HISTORY: % row(s)%', counted, chr(10) || listing;
end $$;

-- ---------------------------------------------------------------------------
-- 12. The private workflow schema AGENTS.md requires be preserved.
-- ---------------------------------------------------------------------------
select
  '12. ifund_ops' as report,
  t.table_name as object,
  (select count(*) from information_schema.columns c
    where c.table_schema = 'ifund_ops' and c.table_name = t.table_name) as columns,
  (select rowsecurity from pg_tables p
    where p.schemaname = 'ifund_ops' and p.tablename = t.table_name) as rls_enabled
from information_schema.tables t
where t.table_schema = 'ifund_ops'
order by t.table_name;
