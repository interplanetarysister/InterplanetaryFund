import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyMigrations,
  actAs,
  freshDb,
  loadPGlite,
  COMMITTED_MIGRATIONS,
} from "./helpers/pglite.js";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const MICHELLE_MIGRATION =
  "supabase/migrations/20261124000000_ifund_michelle_rogers_executive_intelligence.sql";

async function buildDb() {
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  // Add admin_roles table if not present for ifund_is_super_admin() helper
  await db.exec(`
    create table if not exists public.admin_roles (
      user_id uuid not null,
      role text not null,
      primary key (user_id, role)
    );
  `);
  await applyMigrations(db, [MICHELLE_MIGRATION]);
  return db;
}

test("Michelle Rogers migration applies cleanly and creates core executive tables", { skip: SKIP }, async () => {
  const db = await buildDb();
  const { rows } = await db.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_name like 'executive_%'`
  );
  const tables = new Set(rows.map(r => r.table_name));
  assert.ok(tables.has("executive_identities"), "missing executive_identities");
  assert.ok(tables.has("executive_objectives"), "missing executive_objectives");
  assert.ok(tables.has("executive_tasks"), "missing executive_tasks");
  assert.ok(tables.has("executive_correspondence"), "missing executive_correspondence");
  assert.ok(tables.has("executive_meetings"), "missing executive_meetings");
  assert.ok(tables.has("executive_approval_requests"), "missing executive_approval_requests");
  assert.ok(tables.has("executive_audit_events"), "missing executive_audit_events");
  assert.ok(tables.has("executive_operating_modes"), "missing executive_operating_modes");
});

test("Michelle Rogers identity and $450k capital objective are initialized", { skip: SKIP }, async () => {
  const db = await buildDb();
  const { rows: execs } = await db.query(
    `select * from public.executive_identities where slug = 'michelle-rogers'`
  );
  assert.equal(execs.length, 1, "Michelle Rogers identity must exist");
  assert.equal(execs[0].title, "Director of Strategic Partnerships & Capital Development");
  assert.equal(execs[0].organization, "Interplanetary Fund");
  assert.equal(execs[0].email, "michelle@interplanetaryfund.com");
  assert.equal(execs[0].status, "training", "Initial status must be training");

  const { rows: objs } = await db.query(
    `select * from public.executive_objectives where executive_id = $1`,
    [execs[0].id]
  );
  assert.ok(objs.length >= 1, "Initial objective must exist");
  assert.equal(Number(objs[0].target_amount), 450000.00, "Target amount must be $450,000");
  assert.equal(Number(objs[0].current_verified_amount), 0.00, "Initial verified amount must be 0");
});

test("all 30 educational departments (MR-001 to MR-030) are seeded", { skip: SKIP }, async () => {
  const db = await buildDb();
  const { rows } = await db.query(
    `select dept_code, name, category from public.educational_departments order by dept_code`
  );
  assert.equal(rows.length, 30, "Exactly 30 departments must be seeded");
  assert.equal(rows[0].dept_code, "MR-001");
  assert.equal(rows[0].name, "Business Administration");
  assert.equal(rows[29].dept_code, "MR-030");
  assert.equal(rows[29].name, "Interplanetary Fund Operations");
});

test("corporate facts strictly enforce truth classifications", { skip: SKIP }, async () => {
  const db = await buildDb();
  const { rows } = await db.query(
    `select * from public.corporate_facts where subject = 'ifund'`
  );
  assert.ok(rows.length >= 3, "Verified corporate facts must be seeded");

  // Attempt to insert invalid truth class must fail
  await assert.rejects(async () => {
    await db.query(`
      insert into public.corporate_facts (subject, predicate, value, truth_class, source_uri, responsible_owner)
      values ('ifund', 'fake_claim', 'something', 'invented_truth', 'internal:test', 'test')
    `);
  }, /violates check constraint/);
});

test("executive audit events are immutable append-only records", { skip: SKIP }, async () => {
  const db = await buildDb();
  const { rows } = await db.query(`
    insert into public.executive_audit_events (actor, requested_action, result)
    values ('michelle', 'review_proposal', 'success')
    returning id
  `);
  const auditId = rows[0].id;

  // Attempt to UPDATE must be blocked by trigger
  await assert.rejects(async () => {
    await db.query(`update public.executive_audit_events set result = 'tampered' where id = $1`, [auditId]);
  }, /Executive audit events are immutable/);

  // Attempt to DELETE must be blocked by trigger
  await assert.rejects(async () => {
    await db.query(`delete from public.executive_audit_events where id = $1`, [auditId]);
  }, /Executive audit events are immutable/);
});

test("emergency stop and operating modes operate fail-closed", { skip: SKIP }, async () => {
  const db = await buildDb();
  const { rows } = await db.query(
    `select mode, emergency_stop_active, daily_budget_usd from public.executive_operating_modes`
  );
  assert.equal(rows[0].mode, "training");
  assert.equal(rows[0].emergency_stop_active, false);
  assert.equal(Number(rows[0].daily_budget_usd), 5.00);
});

test("communication suppressions enforce uncontactable boundaries", { skip: SKIP }, async () => {
  const db = await buildDb();
  await db.query(`
    insert into public.communication_suppressions (identifier, channel, opt_out_type, source)
    values ('investor@example.com', 'email', 'all', 'user_request')
  `);
  const { rows } = await db.query(
    `select * from public.communication_suppressions where identifier = 'investor@example.com'`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].irreversible_until_review, true);
});
