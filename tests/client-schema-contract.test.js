// Schema contract: every column the client asks for must exist in the schema the
// migrations produce.
//
// This is the guard that was missing. A typo'd or absent column is not caught by
// the client tests, because those use fake clients that answer any query. It is
// only caught at runtime, against the real database, as a PostgREST error — and
// in several of these paths that error is swallowed and rendered as a generic
// message, so the feature silently fails closed with no clue why. That is exactly
// how the original missing-table defect hid.
//
// The column lists are read out of the client source rather than duplicated
// here, so the test cannot drift away from what the client actually sends.
// Skips cleanly when @electric-sql/pglite is absent.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMITTED_MIGRATIONS,
  applyMigrations,
  freshDb,
  loadPGlite,
} from "./helpers/pglite.js";

const PENDING = [
  "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql",
  "supabase/migrations/pending/20261102_ifund_blog_entry_ownership_fix.sql",
  // New canonical community tables are independently reviewed and already applied
  // to production; include their DDL in this isolated schema-contract harness.
  "supabase/migrations/20261113_ifund_public_community_groups.sql",
  // These are source contracts, not an assertion that these migrations have
  // been applied to production. Execute their real DDL so new client reads
  // cannot pass against a hand-written imitation of the application schema.
  "supabase/migrations/20261111154500_ifund_opt_in_atlas_and_owner_agent_focus.sql",
  "supabase/migrations/20261115010000_ifund_ai_permission_preferences.sql",
  "supabase/migrations/20261115095000_ifund_campaign_private_documents.sql",
  // R2 receipt columns for campaign documents (PR #389's worker inserts
  // them and the client selects them; the R2 migration added them to
  // member media only). Without this the list/download selects fail
  // against the migrated schema.
  "supabase/migrations/20261126160000_ifund_campaign_documents_r2_receipt.sql",
  "supabase/migrations/20261115_ifund_mobile_organizer_blocks.sql",
  "supabase/migrations/20261110_ifund_current_legal_terms_sync.sql",
  "supabase/migrations/20261110225840_ifund_campaign_creation_state_20261110.sql",
  // Private operations room (NEXUS advisory analysis): canonical upstream
  // contract — table + RLS + browser write grants.
  "supabase/migrations/20261120114500_ifund_agent_operations_room.sql",
  // Review-completed PUBLIC revocation for the managed-campaign audit guard.
  "supabase/migrations/20261120034000_ifund_guard_public_revocation.sql",
  // What-If mission foundation: mission plan versions selected by apps/web.
  // The foundation migration references the Base44 entity table contract.
  "supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
  "supabase/migrations/20261111_ifund_verified_external_opportunities.sql",
  // Additive reconciliation: grants on requirements_complete exist, but the
  // column was never created by any migration; create it before the grant.
  "supabase/migrations/20261120122000_ifund_opportunity_read_columns.sql",
  "supabase/migrations/20261120122219_ifund_what_if_verified_opportunity_catalog_read.sql",
  "supabase/migrations/20261120042045_ifund_what_if_mission_foundation.sql",
  "supabase/migrations/20261120042253_ifund_what_if_mission_rls_and_indexes.sql",
  // Fundraising events (ifund_events) and external-activity receipts the
  // browser reads directly; execute the real DDL so client reads cannot pass
  // against a hand-written imitation of the application schema.
  "supabase/migrations/20261118194006_ifund_fundraising_events_and_external_activity_20261118.sql",
  // Future internal AI assistance preference selected by the agent side panel.
  "supabase/migrations/20261119110000_ifund_future_internal_ai_assistance_preference.sql",
  // Phase 1 attach & play: posts select media_id (the member-media
  // attachment) in the social client; execute the real DDL so the column
  // and the guard trigger exist in this harness. The member-media library
  // table comes first — the attach migration foreign-keys to it.
  "supabase/migrations/20261113080000_ifund_member_connections_hub.sql",
  "supabase/migrations/20261126064000_ifund_private_member_media_r2.sql",
  "supabase/migrations/20261126200000_ifund_social_post_media_attach.sql",
];

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const source = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

/** The value of `const NAME = "a,b,c";` in a source file, as a column array. */
function constantColumns(path, name) {
  const match = source(path).match(
    new RegExp(`const\\s+${name}\\s*=\\s*"([^"]+)"`),
  );
  assert.ok(match, `const ${name} must be present in ${path}`);
  return match[1]
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Columns from the first `.from("<table>")...select("<cols>")` chain in a file. */
function inlineSelectColumns(path, table) {
  const match = source(path).match(
    new RegExp(`from\\("${table}"\\)[\\s\\S]{0,120}?\\.select\\("([^"]+)"\\)`),
  );
  assert.ok(match, `a select on ${table} must be present in ${path}`);
  return match[1]
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Keys of the object literal passed to `.insert({...})` on a table. */
function insertKeys(path, table) {
  const match = source(path).match(
    new RegExp(`from\\("${table}"\\)[\\s\\S]{0,80}?\\.insert\\(\\{([^}]*)\\}`),
  );
  assert.ok(match, `an insert into ${table} must be present in ${path}`);
  return match[1]
    .split(",")
    .map((pair) => pair.split(":")[0].trim())
    .filter(Boolean);
}

/** Keys of the object literal passed to `.upsert({...})` on a table. */
function upsertKeys(path, table) {
  const match = source(path).match(
    new RegExp(`from\\("${table}"\\)[\\s\\S]{0,120}?\\.upsert\\(\\{([^}]*)\\}`),
  );
  assert.ok(match, `an upsert into ${table} must be present in ${path}`);
  return match[1]
    .split(",")
    .map((pair) => pair.split(":")[0].trim())
    .filter(Boolean);
}

// What the client reads, and where that list is written.
const SELECT_CONTRACTS = [
  {
    table: "ifund_inbox_items",
    path: "apps/web/src/lib/inbox.js",
    columns: () =>
      constantColumns("apps/web/src/lib/inbox.js", "INBOX_COLUMNS"),
  },
  {
    table: "ifund_notifications",
    path: "apps/web/src/lib/inbox.js",
    columns: () =>
      constantColumns("apps/web/src/lib/inbox.js", "NOTIFICATION_COLUMNS"),
  },
  {
    table: "ifund_follows",
    path: "apps/web/src/lib/followedCampaigns.js",
    columns: () =>
      constantColumns("apps/web/src/lib/followedCampaigns.js", "OWN_FIELDS"),
  },
  {
    table: "ifund_campaigns",
    path: "apps/web/src/lib/followedCampaigns.js",
    columns: () =>
      constantColumns(
        "apps/web/src/lib/followedCampaigns.js",
        "CAMPAIGN_FIELDS",
      ),
  },
  {
    table: "ifund_legal_acceptances",
    path: "apps/web/src/components/auth/MemberAccess.jsx",
    columns: () =>
      inlineSelectColumns(
        "apps/web/src/components/auth/MemberAccess.jsx",
        "ifund_legal_acceptances",
      ),
  },
  {
    table: "ifund_profiles",
    path: "apps/web/src/components/auth/MemberAccess.jsx",
    columns: () =>
      inlineSelectColumns(
        "apps/web/src/components/auth/MemberAccess.jsx",
        "ifund_profiles",
      ),
  },
  {
    table: "ifund_agent_operations_messages",
    path: "apps/web/src/components/agents/AgentOperationsRoom.jsx",
    columns: () =>
      inlineSelectColumns(
        "apps/web/src/components/agents/AgentOperationsRoom.jsx",
        "ifund_agent_operations_messages",
      ),
  },
];

// What the client writes, and where that payload is written.
const WRITE_CONTRACTS = [
  {
    table: "ifund_legal_acceptances",
    path: "apps/web/src/components/auth/MemberAccess.jsx",
    keys: () =>
      insertKeys(
        "apps/web/src/components/auth/MemberAccess.jsx",
        "ifund_legal_acceptances",
      ),
  },
  {
    table: "ifund_follows",
    path: "apps/web/src/lib/followedCampaigns.js",
    keys: () =>
      upsertKeys("apps/web/src/lib/followedCampaigns.js", "ifund_follows"),
  },
  {
    table: "ifund_agent_operations_messages",
    path: "apps/web/src/components/agents/AgentOperationsRoom.jsx",
    keys: () =>
      insertKeys(
        "apps/web/src/components/agents/AgentOperationsRoom.jsx",
        "ifund_agent_operations_messages",
      ),
  },
];

/** table -> Set of real column names, from the applied migrations. */
async function realColumns(db) {
  const { rows } = await db.query(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public'`,
  );
  const byTable = new Map();
  for (const row of rows) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Set());
    byTable.get(row.table_name).add(row.column_name);
  }
  return byTable;
}

let dbPromise;
const getDb = () =>
  (dbPromise ??= (async () => {
    const db = await freshDb(PGlite);
    // Supabase-owned Auth/Storage objects referenced by the application DDL.
    // Application tables and columns below still come only from migrations.
    await db.exec(`
      alter table auth.users add column email_confirmed_at timestamptz,
        add column is_anonymous boolean default false;
      create function auth.jwt() returns jsonb language sql stable as $$
        select jsonb_build_object('sub', current_setting('test.uid', true),
          'is_anonymous', false)
      $$;
      create schema storage;
      create table storage.buckets(id text primary key, name text,
        public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),
        bucket_id text, name text, metadata jsonb);
      alter table storage.objects enable row level security;
      create function storage.foldername(path text) returns text[]
        language sql immutable as $$
          select (string_to_array(path, '/'))[1:
            (array_length(string_to_array(path, '/'), 1) - 1)]
        $$;
    `);
    // ifund_private.verified_email_creator is defined by the deferred
    // withdrawal MFA migration, which is not part of this contract harness;
    // the fundraising-events migration calls it while parsing RLS bodies.
    await db.exec(`
      create schema if not exists ifund_private;
      create function ifund_private.verified_email_creator() returns boolean
      language sql stable set search_path = '' as $$ select false $$;
      -- Hosted RPC used by the verified-administrator ops-room policies; the
      -- hosted catalog defines it in production, so create a stand-in when
      -- the migration runs against this isolated harness.
      create or replace function public.ifund_current_user_is_verified_admin()
      returns boolean
      language sql stable set search_path = '' as $$
        select coalesce((select true
          from auth.users u
          where u.id = auth.uid()
            and u.is_anonymous is not true
            and u.email_confirmed_at is not null), false)
      $$;
    `);
    await applyMigrations(db, COMMITTED_MIGRATIONS);
    await applyMigrations(db, PENDING);
    // The restored preference migration requires the hosted lifecycle-aware
    // owner policy, rather than the older owner-only initial-schema policy.
    await db.exec(`alter policy ifund_profiles_update on public.ifund_profiles
      using (id=(select auth.uid()) and public.ifund_current_account_is_active())
      with check (id=(select auth.uid()) and public.ifund_current_account_is_active());`);
    await applyMigrations(db, ["supabase/migrations/20261103192435_ifund_communications_preferences_20261103.sql"]);
    return db;
  })());

test(
  "every column the client selects exists in the migrated schema",
  { skip: SKIP },
  async () => {
    const columns = await realColumns(await getDb());
    for (const contract of SELECT_CONTRACTS) {
      const real = columns.get(contract.table);
      assert.ok(real, `${contract.table} must exist in the schema`);
      for (const column of contract.columns()) {
        assert.ok(
          real.has(column),
          `${contract.table}.${column} is selected by ${contract.path} but is not a column of the migrated table`,
        );
      }
    }
  },
);

/** Every file under a source tree, recursively. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SRC_TREES = ["src", "apps/web/src"];

/**
 * Every explicit column list the codebase selects, discovered rather than
 * hand-listed, so new code is covered without editing this test.
 * Returns [{ table, columns, where }].
 */
function discoverSelects() {
  const found = [];
  for (const tree of SRC_TREES) {
    let files;
    try {
      files = walk(fileURLToPath(new URL("../" + tree + "/", import.meta.url)));
    } catch {
      continue; // tree absent
    }
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const pattern =
        /from\(\s*"(ifund_[a-z_]+)"\s*\)[\s\S]{0,160}?\.select\(\s*"([^"]+)"\s*\)/g;
      for (const match of text.matchAll(pattern)) {
        const columns = match[2]
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        // `*` and embedded relations are not plain column lists.
        if (columns.includes("*") || columns.some((c) => c.includes("(")))
          continue;
        found.push({
          table: match[1],
          columns,
          where: file.replace(/^.*\/(src|apps)\//, "$1/"),
        });
      }
    }
  }
  return found;
}

test(
  "every discovered select in the codebase resolves against the schema",
  { skip: SKIP },
  async () => {
    const columns = await realColumns(await getDb());
    const discovered = discoverSelects();
    // The scanner must find real contracts, or this passes for the wrong reason.
    assert.ok(
      discovered.length >= 5,
      `expected to discover several explicit selects, found ${discovered.length}`,
    );
    for (const { table, columns: selected, where } of discovered) {
      const real = columns.get(table);
      assert.ok(
        real,
        `${table} is queried by ${where} but does not exist in the schema`,
      );
      for (const column of selected) {
        assert.ok(
          real.has(column),
          `${table}.${column} is selected by ${where} but is not a column of the migrated table`,
        );
      }
    }
  },
);

test(
  "every column the client writes exists in the migrated schema",
  { skip: SKIP },
  async () => {
    const columns = await realColumns(await getDb());
    for (const contract of WRITE_CONTRACTS) {
      const real = columns.get(contract.table);
      assert.ok(real, `${contract.table} must exist in the schema`);
      for (const key of contract.keys()) {
        assert.ok(
          real.has(key),
          `${contract.table}.${key} is written by ${contract.path} but is not a column of the migrated table`,
        );
      }
    }
  },
);

test(
  "the parsers actually found the contracts they claim to",
  { skip: SKIP },
  async () => {
    // Guards against a regex silently matching nothing and the suites above
    // passing vacuously. Every contract must yield at least one column.
    for (const contract of SELECT_CONTRACTS) {
      assert.ok(
        contract.columns().length > 0,
        `no columns parsed for ${contract.table}`,
      );
    }
    for (const contract of WRITE_CONTRACTS) {
      assert.ok(
        contract.keys().length > 0,
        `no keys parsed for ${contract.table}`,
      );
    }
    // And spot-check a known list so a wrong-but-nonempty parse is caught.
    assert.deepEqual(
      constantColumns("apps/web/src/lib/inbox.js", "NOTIFICATION_COLUMNS"),
      ["id", "owner_id", "title", "body", "type", "link", "read", "created_at"],
    );
  },
);

test(
  "the browser never gets a column the account lifecycle owns",
  { skip: SKIP },
  async () => {
    // account_status and account_deletion_pending are server-owned: readable by the
    // owner so the gate works, but never writable from the browser. A write grant
    // here would let an account activate itself.
    const db = await getDb();
    const { rows } = await db.query(
      `select column_name, privilege_type
     from information_schema.column_privileges
     where table_schema='public' and table_name='ifund_profiles'
       and grantee='authenticated' and privilege_type in ('INSERT','UPDATE')`,
    );
    for (const row of rows) {
      assert.ok(
        !["account_status", "account_deletion_pending"].includes(
          row.column_name,
        ),
        `authenticated must not hold ${row.privilege_type} on ifund_profiles.${row.column_name}`,
      );
    }
  },
);
