import test from "node:test";
import assert from "node:assert/strict";
import { fixture, as } from "./connections-fixture.js";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  campaign = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  connection = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  policy = "ifund-help-2026-11-v1";
const rpc = async (db, name, args = []) =>
  (
    await db.query(
      `select public.ifund_connections_${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
async function seeded() {
  const db = await fixture();
  await db.exec("update ifund_access.member_entitlements set tier='outreach'");
  await db.query(
    "insert into public.ifund_campaigns(id,owner_id,title) values($1,$2,'Classroom'),($3,$4,'Other private campaign')",
    [campaign, owner, foreign, other],
  );
  await db.query(
    "insert into public.ifund_connections(id,owner_id,provider,status,verified_at) values($1,$2,'discord','connected',now())",
    [connection, owner],
  );
  await as(db, owner);
  return db;
}
const grant = (
  db,
  provider = "discord",
  camp = campaign,
  op = crypto.randomUUID(),
  version = policy,
  confirmed = true,
) => rpc(db, "grant_help", [op, provider, camp, version, confirmed]);
const request = (
  db,
  provider = "discord",
  camp = campaign,
  action = "connect",
  conn = null,
  op = crypto.randomUUID(),
) => rpc(db, "request_action", [op, provider, camp, action, conn]);
const selection = (rows) =>
  rows.map((r) => ({ id: r.id, revision: r.revision }));
const change = (db, kind, rows, op = crypto.randomUUID()) =>
  rpc(db, "change_selected", [op, kind, selection(rows)]);
test("current explicit scoped permission and idempotent canonical requests never invent provider connection or financial authority", async () => {
  const db = await seeded();
  try {
    const op = crypto.randomUUID(),
      g = await grant(db, "discord", campaign, op);
    assert.equal(g.permission.status, "active");
    assert.equal(g.permission.policy_version, policy);
    assert.equal((await grant(db, "discord", campaign, op)).replayed, true);
    await assert.rejects(
      grant(db, "facebook", campaign, op),
      /Request changed/,
    );
    const req = crypto.randomUUID(),
      r = await request(db, "discord", campaign, "connect", null, req);
    assert.equal(r.request.state, "setup_required");
    assert.equal(r.request.status, "waiting_external");
    assert.equal(
      (await request(db, "discord", campaign, "connect", null, req)).replayed,
      true,
    );
    await assert.rejects(
      request(db, "discord", campaign, "create_account", null, req),
      /Request changed/,
    );
    const w = await rpc(db, "workspace");
    assert.equal(w.connections[0].status, "verification_required");
    assert.equal(w.connections[0].financial_authority, false);
    assert.deepEqual(w.connections[0].capabilities, []);
    assert.equal(w.requests.length, 1);
    await db.exec("reset role");
    const d = (await db.query("select * from public.ifund_agent_delegation"))
      .rows;
    assert.equal(d.length, 1);
    assert.equal(d[0].destination_agent, "managed_connection_agent");
    assert.equal(d[0].status, "waiting_external");
    assert.equal(
      (await db.query("select count(*)::int n from ifund_ops.workflow_jobs"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("no permission can be inferred from legacy grants, OAuth hints, saved status or current membership", async () => {
  const db = await seeded();
  try {
    await assert.rejects(request(db), /permission required/);
    await db.exec("reset role");
    await db.query(
      "insert into public.ifund_authorization_grant(id,user_id,agent_name,platform,status,source_system) values('legacy',$1,'managed_connection_agent','discord','active','base44')",
      [owner],
    );
    await as(db, owner);
    await assert.rejects(request(db), /permission required/);
    for (const args of [
      [crypto.randomUUID(), "discord", campaign, "old", true],
      [crypto.randomUUID(), "discord", campaign, policy, false],
      [crypto.randomUUID(), "unknown", campaign, policy, true],
    ])
      await assert.rejects(rpc(db, "grant_help", args));
  } finally {
    await db.close();
  }
});
test("two owners: campaigns, matching repair targets, permission scope and private workspace are isolated", async () => {
  const db = await seeded();
  try {
    await assert.rejects(grant(db, "discord", foreign), /Owned campaign/);
    await grant(db);
    await assert.rejects(request(db, "discord", null), /permission required/);
    await assert.rejects(request(db, "discord", foreign), /Owned campaign/);
    await assert.rejects(
      request(db, "discord", campaign, "repair", null),
      /Invalid connection/,
    );
    await assert.rejects(
      request(db, "discord", campaign, "repair", foreign),
      /Owned matching/,
    );
    const r = await request(db, "discord", campaign, "repair", connection);
    assert.equal(r.request.connection_id, connection);
    await as(db, other);
    const w = await rpc(db, "workspace");
    assert.equal(w.requests.length, 0);
    assert.equal(w.permissions.length, 0);
    assert.equal(w.connections.length, 0);
    await assert.rejects(
      request(db, "discord", foreign, "repair", connection),
      /Owned matching/,
    );
  } finally {
    await db.close();
  }
});
test("bulk revocation validates the entire owner selection and revision before atomic changes", async () => {
  const db = await seeded();
  try {
    const a = (await grant(db)).permission,
      b = (await grant(db, "facebook")).permission;
    await request(db);
    await as(db, other);
    const c = (await grant(db, "discord", foreign)).permission;
    await as(db, owner);
    await assert.rejects(change(db, "revoke", [a, c]), /Owned current/);
    assert.equal(
      (await rpc(db, "workspace")).permissions.find((p) => p.id === a.id)
        .status,
      "active",
    );
    await assert.rejects(
      change(db, "revoke", [a, { ...b, revision: crypto.randomUUID() }]),
      /Selection changed/,
    );
    await assert.rejects(change(db, "revoke", [a, a]), /unique/);
    const op = crypto.randomUUID(),
      done = await change(db, "revoke", [a, b], op);
    assert.equal(done.changed.length, 2);
    assert.equal(done.provider_access_revoked, false);
    assert.equal((await change(db, "revoke", [a, b], op)).replayed, true);
    const w = await rpc(db, "workspace");
    assert.ok(w.permissions.every((p) => p.status === "revoked"));
    assert.equal(w.requests[0].status, "cancelled");
    await assert.rejects(request(db), /permission required/);
  } finally {
    await db.close();
  }
});
test("bulk request cancellation is scoped and receipt replay cannot cancel later requests", async () => {
  const db = await seeded();
  try {
    await grant(db);
    const a = (await request(db)).request,
      b = (await request(db, "discord", campaign, "create_account")).request;
    const op = crypto.randomUUID();
    assert.equal((await change(db, "cancel", [a, b], op)).changed.length, 2);
    const later = (await request(db)).request;
    await change(db, "cancel", [a, b], op);
    assert.equal(
      (await rpc(db, "workspace")).requests.find((r) => r.id === later.id)
        .status,
      "waiting_external",
    );
    await assert.rejects(change(db, "cancel", [a, later]), /Owned current/);
    assert.equal(
      (await rpc(db, "workspace")).requests.find((r) => r.id === later.id)
        .status,
      "waiting_external",
    );
  } finally {
    await db.close();
  }
});
test("replacement permission invalidates prior pending work and stale revocation review", async () => {
  const db = await seeded();
  try {
    const a = (await grant(db)).permission;
    const r = (await request(db)).request;
    const b = (await grant(db)).permission;
    assert.notEqual(a.id, b.id);
    const w = await rpc(db, "workspace");
    assert.equal(w.requests.find((x) => x.id === r.id).status, "cancelled");
    assert.equal(w.permissions.find((x) => x.id === a.id).status, "revoked");
    await assert.rejects(change(db, "revoke", [a]), /Owned current/);
    assert.equal((await request(db)).request.status, "waiting_external");
  } finally {
    await db.close();
  }
});
test("expired or stale permission is unusable; plan expiry retains read, cancellation and revocation access", async () => {
  const db = await seeded();
  try {
    const g = (await grant(db)).permission;
    const r = (await request(db)).request;
    await db.exec("reset role");
    await db.query(
      "update ifund_connections_runtime.permissions set expires_at=now()-interval '1 minute' where grant_id=$1",
      [g.id],
    );
    await as(db, owner);
    await assert.rejects(request(db), /permission required/);
    await db.exec(
      "reset role;update ifund_access.member_entitlements set verified_at=now()-interval '1 day',valid_until=now()-interval '1 minute'",
    );
    await as(db, owner);
    assert.equal((await rpc(db, "workspace")).managed_available, false);
    await assert.rejects(grant(db), /plan required/);
    await assert.rejects(request(db), /plan required/);
    await change(db, "cancel", [r]);
    await change(db, "revoke", [g]);
    assert.equal((await rpc(db, "workspace")).permissions[0].status, "revoked");
  } finally {
    await db.close();
  }
});
test("rate limits stop duplicate new intents while receipt replay remains available", async () => {
  const db = await seeded();
  try {
    await grant(db);
    const op = crypto.randomUUID();
    await request(db, "discord", campaign, "connect", null, op);
    for (let n = 1; n < 10; n++) await request(db);
    await assert.rejects(request(db), /limit reached/);
    assert.equal(
      (await request(db, "discord", campaign, "connect", null, op)).replayed,
      true,
    );
  } finally {
    await db.close();
  }
});
test("confirmed active account and legal acceptance are checked server-side independently of UI and entitlement", async () => {
  const db = await seeded();
  try {
    for (const sql of [
      "update auth.users set email_confirmed_at=null where id='" + owner + "'",
      "update public.ifund_profiles set account_status='suspended' where id='" +
        owner +
        "'",
      "update public.ifund_profiles set account_deletion_pending=true where id='" +
        owner +
        "'",
      "delete from public.ifund_legal_acceptances where owner_id='" +
        owner +
        "'",
    ]) {
      await db.exec("reset role;begin;" + sql);
      await as(db, owner);
      await assert.rejects(rpc(db, "workspace"), /Member access/);
      await db.exec("rollback;reset role");
    }
    await db.exec(
      "reset role;update ifund_connections_runtime.control set enabled=false",
    );
    await as(db, owner);
    await assert.rejects(rpc(db, "workspace"), /unavailable/);
  } finally {
    await db.close();
  }
});
test("only authenticated invoker APIs are exposed; operational and canonical raw writes remain denied", async () => {
  const db = await seeded();
  try {
    await assert.rejects(
      db.query("select * from ifund_connections_runtime.permissions"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select ifund_connections_runtime.require_member(true)"),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.ifund_authorization_grant(id) values('forged')",
      ),
      /permission denied/,
    );
    await as(db, null, "anon");
    await assert.rejects(rpc(db, "workspace"), /permission denied/);
    await db.exec("reset role");
    const rows = (
      await db.query(
        "select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ifund_connections_%'",
      )
    ).rows;
    assert.equal(rows.length, 4);
    assert.ok(rows.every((r) => r.prosecdef === false));
  } finally {
    await db.close();
  }
});

test("campaign deletion remains possible and revokes rather than widens campaign-scoped assistance", async () => {
  const db = await seeded();
  try {
    await grant(db);
    await request(db);
    await db.exec("reset role");
    await db.query("delete from public.ifund_campaigns where id=$1", [
      campaign,
    ]);
    await as(db, owner);
    const w = await rpc(db, "workspace");
    assert.equal(w.permissions[0].status, "revoked");
    assert.equal(w.permissions[0].campaign_id, campaign);
    assert.equal(w.requests[0].status, "cancelled");
    assert.equal(w.requests[0].campaign_id, campaign);
    await assert.rejects(request(db, "discord", null), /permission required/);
  } finally {
    await db.close();
  }
});
