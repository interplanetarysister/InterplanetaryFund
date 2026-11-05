import test from "node:test";
import assert from "node:assert/strict";
import { fixture, as } from "./strategy-fixture.js";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  campaign = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  request = "33333333-3333-4333-8333-333333333333",
  op = "44444444-4444-4444-8444-444444444444";
const rec = {
  campaign_id: campaign,
  title: "Clarify the need",
  description: "Describe supplies",
  reasoning: "Clearer context",
  evidence: "The campaign mentions supplies",
  confidence: "medium",
  expected_impact: "May improve clarity",
  estimated_effort: "One hour",
  agent: "story",
};
const plan = {
  summary: "Focus on the supplied need",
  today_priorities: ["Check facts", "Clarify need"],
  week_priorities: ["Review copy", "Review progress"],
  long_term: ["Keep records", "Reassess"],
  risks: ["Outcomes unknown"],
  predictions: [
    {
      forecast: "Copy may improve",
      confidence: "low",
      evidence: "No outcome data",
      recommended_action: "Review copy",
    },
  ],
  recommendations: [
    rec,
    { ...rec, title: "Review cover" },
    { ...rec, title: "Plan review" },
  ],
};
async function seeded() {
  const db = await fixture();
  await db.query(
    "insert into public.ifund_campaigns(id,owner_id,title,summary,status) values($1,$2,'Supplies','School supplies','draft'),($3,$4,'Private','Foreign details','draft')",
    [campaign, uid, foreign, other],
  );
  await as(db, uid);
  return db;
}
const rpc = async (db, name, args = []) =>
  (
    await db.query(
      `select public.ifund_strategy_${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
const claim = (db) => rpc(db, "begin", [request, "a".repeat(64)]);
async function generated(db) {
  const c = await claim(db);
  return rpc(db, "finish", [request, c.lease, plan]);
}
const selection = (rows) =>
  rows.map((r) => ({ id: r.id, revision: r.updated_at }));
test("canonical plan, ranked recommendations, immutable replay and owner denial", async () => {
  const db = await seeded();
  try {
    const result = await generated(db);
    assert.equal(result.brief.summary, plan.summary);
    assert.deepEqual(
      result.recommendations.map((r) => r.rank),
      [1, 2, 3],
    );
    assert.equal((await claim(db)).state, "completed");
    assert.equal(
      (await claim(db)).result.brief.generated_at,
      result.brief.generated_at,
    );
    await as(db, other);
    assert.equal((await rpc(db, "workspace")).brief, null);
    assert.deepEqual((await rpc(db, "workspace")).recommendations, []);
    await assert.rejects(
      rpc(db, "bulk", [op, selection(result.recommendations), "accepted"]),
    );
    await assert.rejects(db.exec("select * from public.ifund_recommendation"));
    await as(db, null, "anon");
    await assert.rejects(rpc(db, "workspace"));
  } finally {
    await db.close();
  }
});
test("bulk changes are atomic, bounded, revision checked and replay safe", async () => {
  const db = await seeded();
  try {
    const result = await generated(db);
    const items = selection(result.recommendations);
    const done = await rpc(db, "bulk", [op, items, "accepted"]);
    assert.equal(done.changed, 3);
    assert.equal(
      (await rpc(db, "bulk", [op, items, "accepted"])).replayed,
      true,
    );
    await assert.rejects(rpc(db, "bulk", [op, items, "dismissed"]));
    await assert.rejects(
      rpc(db, "bulk", [crypto.randomUUID(), [items[0], items[0]], "open"]),
    );
    const fresh = await rpc(db, "workspace");
    assert.ok(fresh.recommendations.every((r) => r.status === "accepted"));
    const mixed = selection(fresh.recommendations);
    mixed[2].revision = items[2].revision;
    await assert.rejects(
      rpc(db, "bulk", [crypto.randomUUID(), mixed, "dismissed"]),
    );
    assert.ok(
      (await rpc(db, "workspace")).recommendations.every(
        (r) => r.status === "accepted",
      ),
    );
    const reopened = await rpc(db, "bulk", [
      crypto.randomUUID(),
      selection(fresh.recommendations),
      "open",
    ]);
    assert.equal(reopened.changed, 3);
  } finally {
    await db.close();
  }
});
test("refresh preserves owner decisions and imported records; only open suggestions replaced", async () => {
  const db = await seeded();
  try {
    const result = await generated(db);
    await rpc(db, "bulk", [
      op,
      selection([result.recommendations[0]]),
      "accepted",
    ]);
    await db.exec("reset role");
    await db.query(
      "insert into public.ifund_recommendation(id,owner_user_id,title,status,source_system) values('imported',$1,'Legacy','open','base44')",
      [uid],
    );
    await as(db, uid);
    const id = crypto.randomUUID(),
      next = await rpc(db, "begin", [id, "b".repeat(64)]);
    const result2 = await rpc(db, "finish", [
      id,
      next.lease,
      { ...plan, summary: "Updated" },
    ]);
    assert.equal(result2.recommendations.length, 4);
    assert.equal(
      result2.recommendations.filter((r) => r.status === "accepted").length,
      1,
    );
    assert.equal((await claim(db)).result.brief.summary, plan.summary);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int n from public.ifund_mission_brief"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.ifund_recommendation where id='imported'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("invalid or foreign plans roll back all writes; stale leases cannot commit", async () => {
  const db = await seeded();
  try {
    const c = await claim(db);
    await assert.rejects(
      rpc(db, "finish", [
        request,
        c.lease,
        {
          ...plan,
          recommendations: [rec, rec, { ...rec, campaign_id: foreign }],
        },
      ]),
    );
    assert.equal((await rpc(db, "workspace")).brief, null);
    await assert.rejects(
      rpc(db, "finish", [request, crypto.randomUUID(), plan]),
    );
    await db.exec("reset role");
    await db.exec(
      "update ifund_ops.workflow_jobs set lease_until=now()-interval '1 second'",
    );
    await as(db, uid);
    await assert.rejects(rpc(db, "finish", [request, c.lease, plan]));
    assert.equal((await claim(db)).state, "failed");
  } finally {
    await db.close();
  }
});
test("context exposes only owned verified captured gifts grouped by currency", async () => {
  const db = await seeded();
  try {
    await db.exec("reset role");
    await db.query(
      "insert into public.ifund_donations values(gen_random_uuid(),$1,500,'USD','captured','verified',now()),(gen_random_uuid(),$1,800,'EUR','captured','verified2',now()),(gen_random_uuid(),$1,900,'USD','created',null,null),(gen_random_uuid(),$2,100000,'USD','captured','foreign',now())",
      [campaign, foreign],
    );
    await as(db, uid);
    const context = await rpc(db, "context");
    assert.equal(context.campaigns.length, 1);
    assert.deepEqual(context.communications, { available: false });
    const metrics = context.verified_donation_activity.by_campaign_currency;
    assert.equal(metrics.length, 2);
    assert.deepEqual(metrics.map((m) => m.gift_cents).sort(), ["500", "800"]);
    assert.ok(metrics.every((m) => !("paypal_capture_id" in m)));
    assert.ok(!JSON.stringify(context).includes("Foreign details"));
  } finally {
    await db.close();
  }
});
test("disabled, unconfirmed, suspended, deletion-pending, expired and no-consent members denied", async () => {
  const db = await seeded();
  try {
    for (const change of [
      "update ifund_strategy_runtime.control set enabled=false",
      "update auth.users set email_confirmed_at=null",
      "update public.ifund_profiles set account_status='suspended'",
      "update public.ifund_profiles set account_deletion_pending=true",
      "update ifund_access.member_entitlements set valid_until=now()-interval '1 second',verified_at=now()-interval '1 day'",
      "delete from public.ifund_legal_acceptances",
    ]) {
      await db.exec("reset role;begin;");
      await db.exec(change);
      await as(db, uid);
      await assert.rejects(rpc(db, "workspace"));
      await db.exec("rollback");
    }
  } finally {
    await db.close();
  }
});
test("inference allowance includes failed attempts and blocks concurrent owner runs", async () => {
  const db = await seeded();
  try {
    const first = await claim(db);
    assert.equal(first.state, "claimed");
    assert.equal(
      (await rpc(db, "begin", [crypto.randomUUID(), "c".repeat(64)])).state,
      "in_progress",
    );
    await rpc(db, "finish", [request, first.lease, null]);
    assert.equal((await claim(db)).state, "failed");
    const id = crypto.randomUUID(),
      second = await rpc(db, "begin", [id, "c".repeat(64)]);
    await rpc(db, "finish", [id, second.lease, null]);
    assert.equal(
      (await rpc(db, "begin", [crypto.randomUUID(), "d".repeat(64)])).state,
      "limited",
    );
  } finally {
    await db.close();
  }
});
test("campaign selection cannot include another owner, and committed recommendations stay within selected scope", async () => {
  const db = await seeded();
  try {
    await assert.rejects(rpc(db, "context", [[campaign, foreign]]));
    const context = await rpc(db, "context", [[campaign]]);
    assert.equal(context.campaigns.length, 1);
    const c = await rpc(db, "begin", [request, "a".repeat(64), [campaign]]);
    assert.equal(c.state, "claimed");
    await rpc(db, "finish", [request, c.lease, plan]);
  } finally {
    await db.close();
  }
});
test("mixed-owner batch rolls back all decisions; brief identity conflicts preserve imported data", async () => {
  const db = await seeded();
  try {
    const result = await generated(db);
    await db.exec("reset role");
    await db.query(
      "insert into public.ifund_recommendation(id,campaign_id,owner_user_id,title,status,source_system) values($1,$2,$3,'Private','open','ifund_strategy_v1')",
      [foreign, foreign, other],
    );
    const row = (
      await db.query(
        "select updated_at from public.ifund_recommendation where id=$1",
        [foreign],
      )
    ).rows[0];
    await as(db, uid);
    await assert.rejects(
      rpc(db, "bulk", [
        op,
        [
          ...selection(result.recommendations),
          { id: foreign, revision: row.updated_at },
        ],
        "accepted",
      ]),
    );
    assert.ok(
      (await rpc(db, "workspace")).recommendations.every(
        (r) => r.status === "open",
      ),
    );
    await db.exec("reset role");
    await db.exec(
      "update public.ifund_mission_brief set source_system='base44',summary='Keep imported evidence'",
    );
    await as(db, uid);
    const id = crypto.randomUUID(),
      c = await rpc(db, "begin", [id, "b".repeat(64)]);
    await assert.rejects(rpc(db, "finish", [id, c.lease, plan]));
    await db.exec("reset role");
    assert.equal(
      (await db.query("select summary from public.ifund_mission_brief")).rows[0]
        .summary,
      "Keep imported evidence",
    );
  } finally {
    await db.close();
  }
});
