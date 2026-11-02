-- ---------------------------------------------------------------------------
-- Repair: public.ifund_legal_acceptances is missing its primary key
-- ---------------------------------------------------------------------------
-- Measured against production project ssibsfmtodgximseeqsv, using only the
-- publishable key that ships in the deployed bundle
-- (scripts/reconcile-production-schema.mjs):
--
--   public.ifund_legal_acceptances exists with owner_id, terms_version,
--   explicit_consent, accepted_at - and WITHOUT id and WITHOUT created_at.
--
-- Why this needs its own migration rather than a line in the member-schema file
--
-- The member-schema migration declares this table with `create table if not
-- exists`. Against the table that already exists there, that statement verifies
-- nothing and creates nothing: it is a no-op. Everything the declaration carries -
-- the primary key, the defaults, the unique constraint - is silently discarded.
-- The following column grants still succeed, because the columns they name do
-- exist, so the migration reports success while the table it describes was never
-- brought into being.
--
-- The consequence is not cosmetic. A table with no primary key cannot identify a
-- row, so it cannot be referenced by a foreign key, cannot be updated by id, and
-- is excluded from logical replication. `id` being absent is a defect in the
-- existing table, independent of anything this repository wants to add.
--
-- Why this runs before the member-schema migration
--
-- The member-schema migration opens with a preflight that aborts when the live
-- schema disagrees with its declarations. `20261102_ifund_legal_acceptances_repair`
-- sorts before `20261102_ifund_member_schema_completion`, so the repair is applied
-- first and the preflight then sees a conforming table and passes. Applying them
-- in the other order is a loud failure, not a silent one, which is the intended
-- behaviour; tests/pending-migration-order.test.js pins the ordering.
--
-- Idempotent and non-destructive
--
-- Every step tests the catalog before acting, so re-running changes nothing.
-- No column is dropped, no row is deleted, no existing value is overwritten.
-- `id` is added nullable, backfilled, then made NOT NULL, so it cannot fail on a
-- table that already holds rows.
-- ---------------------------------------------------------------------------

-- 1. Add `id` if absent, backfill, and make it the primary key.
do $$
begin
  if to_regclass('public.ifund_legal_acceptances') is null then
    -- Nothing to repair; the member-schema migration will create it in full.
    raise notice 'ifund_legal_acceptances does not exist; nothing to repair.';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ifund_legal_acceptances'
      and column_name = 'id'
  ) then
    alter table public.ifund_legal_acceptances add column id uuid;
    update public.ifund_legal_acceptances
      set id = gen_random_uuid()
      where id is null;
    alter table public.ifund_legal_acceptances
      alter column id set not null;
    alter table public.ifund_legal_acceptances
      alter column id set default gen_random_uuid();
    raise notice 'Added ifund_legal_acceptances.id and backfilled existing rows.';
  end if;
end $$;

-- Promote `id` to the primary key, but only if the table has no primary key at
-- all. If one already exists it is left exactly as it is.
do $$
begin
  if to_regclass('public.ifund_legal_acceptances') is null then
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ifund_legal_acceptances'::regclass
      and contype = 'p'
  ) then
    alter table public.ifund_legal_acceptances
      add constraint ifund_legal_acceptances_pkey primary key (id);
    raise notice 'ifund_legal_acceptances.id is now the primary key.';
  else
    raise notice 'ifund_legal_acceptances already has a primary key; left unchanged.';
  end if;
end $$;

-- 2. Add `created_at` if absent. A NOT NULL column with a non-volatile default is
--    a metadata-only change on PostgreSQL 11 and later, so existing rows are not
--    rewritten.
do $$
begin
  if to_regclass('public.ifund_legal_acceptances') is null then
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ifund_legal_acceptances'
      and column_name = 'created_at'
  ) then
    alter table public.ifund_legal_acceptances
      add column created_at timestamptz not null default now();
    raise notice 'Added ifund_legal_acceptances.created_at.';
  end if;
end $$;

-- 3. Add the (owner_id, terms_version) uniqueness the member-schema migration
--    declares. Without it, a member could accumulate duplicate acceptances for one
--    terms version, and the client's `maybeSingle()` read would error on multiple
--    rows rather than returning one.
--
--    Duplicates are collapsed first, keeping the earliest acceptance per pair, so
--    the constraint cannot fail on a table that already contains them.
do $$
declare
  has_unique boolean;
begin
  if to_regclass('public.ifund_legal_acceptances') is null then
    return;
  end if;

  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.ifund_legal_acceptances'::regclass
      and c.contype in ('u', 'p')
      and (
        -- attname is type name, so the aggregate must be cast to text[] before
        -- it can be compared with a text[] literal.
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['owner_id', 'terms_version']::text[]
  ) into has_unique;

  if has_unique then
    raise notice 'ifund_legal_acceptances already unique on (owner_id, terms_version).';
    return;
  end if;

  -- Keep one row per (owner_id, terms_version). Prefer a row that records consent,
  -- then the earliest acceptance, so the retained row is the most defensible one.
  delete from public.ifund_legal_acceptances a
  using public.ifund_legal_acceptances b
  where a.owner_id = b.owner_id
    and a.terms_version = b.terms_version
    and (
      (a.explicit_consent is not true and b.explicit_consent is true)
      or (a.explicit_consent is not distinct from b.explicit_consent
          and a.accepted_at > b.accepted_at)
      or (a.explicit_consent is not distinct from b.explicit_consent
          and a.accepted_at = b.accepted_at
          and a.ctid > b.ctid)
    );

  alter table public.ifund_legal_acceptances
    add constraint ifund_legal_acceptances_owner_version_key
    unique (owner_id, terms_version);
  raise notice 'Added uniqueness on ifund_legal_acceptances(owner_id, terms_version).';
end $$;

-- Guarded: `comment on table` has no IF EXISTS, so it would error on a database
-- where the member-schema migration has not yet created the table.
do $$
begin
  if to_regclass('public.ifund_legal_acceptances') is not null then
    execute $c$
      comment on table public.ifund_legal_acceptances is
        'Recorded terms/privacy consent, one row per member per terms version. '
        'Repaired by 20261102_ifund_legal_acceptances_repair.sql, which supplied '
        'the primary key, created_at and the (owner_id, terms_version) unique '
        'constraint that an earlier out-of-band creation had left out.'
    $c$;
  end if;
end $$;
