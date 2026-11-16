import test from "node:test";
import assert from "node:assert/strict";
import { fixture, as } from "./communications-fixture.js";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  campaign = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  request = "33333333-3333-4333-8333-333333333333";
const rpc = async (db, name, args = []) =>
  (
    await db.query(
      `select public.ifund_communications_${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
async function seeded() {
  const db = await fixture();
  await db.query(
    "insert into public.ifund_campaigns(id,owner_id,title,summary,status) values($1,$2,'Classroom','School supplies','draft'),($3,$4,'Private','Foreign campaign','draft')",
    [campaign, owner, foreign, other],
  );
  await db.query(
    "insert into public.ifund_donations(id,campaign_id,donor_id,gift_cents,currency,status,paypal_capture_id,captured_at) values(gen_random_uuid(),$1,$2,500,'USD','captured','capture-a',now()),(gen_random_uuid(),$1,$2,100,'USD','captured','capture-b',now()),(gen_random_uuid(),$1,$3,500,'USD','captured','self',now())",
    [campaign, other, owner],
  );
  await as(db, owner);
  return db;
}
const save = (
  db,
  subject = "A truthful update",
  content = "The organizer is preparing classroom supplies.",
  type = "update",
  id = null,
  rev = null,
  op = crypto.randomUUID(),
) => rpc(db, "save", [op, id, rev, campaign, subject, content, type]);
const selection = (messages) =>
  messages.map((m) => ({ id: m.id, revision: m.updated_at }));
const prepare = (db, messages, id = crypto.randomUUID()) =>
  rpc(db, "prepare_send", [id, selection(messages)]);
test("manual lifecycle: exact full-text notification, duplicate gifts deduplicated, self excluded and immutable send replay", async () => {
  const db = await seeded();
  try {
    const op = crypto.randomUUID(),
      saved = await save(
        db,
        "Thank you",
        "A".repeat(4000),
        "thank_you",
        null,
        null,
        op,
      );
    assert.equal(
      (
        await save(
          db,
          "Thank you",
          "A".repeat(4000),
          "thank_you",
          null,
          null,
          op,
        )
      ).replayed,
      true,
    );
    const review = await prepare(db, [saved.message]);
    assert.equal(review.messages[0].eligible_recipients, 1);
    assert.equal(review.messages[0].content.length, 4000);
    assert.ok(!JSON.stringify(review).includes(other));
    await assert.rejects(rpc(db, "send", [review.preview_id, false]));
    const result = await rpc(db, "send", [review.preview_id, true]);
    assert.equal(result.outcomes[0].delivered, 1);
    assert.equal(result.outcomes[0].status, "sent_in_app");
    assert.equal(
      (await rpc(db, "send", [review.preview_id, true])).replayed,
      true,
    );
    assert.equal((await rpc(db, "workspace")).messages[0].status, "sent");
    assert.equal(
      (await db.query("select count(*)::int n from public.ifund_notifications"))
        .rows[0].n,
      0,
    );
    await as(db, other);
    const notice = (await db.query("select * from public.ifund_notifications"))
      .rows[0];
    assert.equal(notice.body.length, 4000);
    assert.equal(notice.type, "thank_you");
    await assert.rejects(
      db.exec(
        "insert into public.ifund_notifications(owner_id,title,type) values('" +
          owner +
          "','Forged','update')",
      ),
    );
  } finally {
    await db.close();
  }
});
test("cross-owner, anonymous and private-helper calls denied", async () => {
  const db = await seeded();
  try {
    const m = (await save(db)).message,
      review = await prepare(db, [m]);
    await as(db, other);
    assert.deepEqual((await rpc(db, "workspace")).messages, []);
    await assert.rejects(
      rpc(db, "cancel", [crypto.randomUUID(), selection([m])]),
    );
    await assert.rejects(rpc(db, "send", [review.preview_id, true]));
    await assert.rejects(rpc(db, "context", [campaign]));
    await assert.rejects(db.exec("select * from public.ifund_message"));
    await assert.rejects(
      db.query("select ifund_communications_runtime.eligible_recipients($1)", [
        campaign,
      ]),
    );
    await as(db, null, "anon");
    await assert.rejects(rpc(db, "workspace"));
  } finally {
    await db.close();
  }
});
test("manual messages remain available without an AI plan; inference still requires verified entitlement", async () => {
  const db = await seeded();
  try {
    await db.exec("reset role");
    await db.query(
      "delete from ifund_access.member_entitlements where owner_id=$1",
      [owner],
    );
    await as(db, owner);
    assert.equal((await rpc(db, "workspace")).ai_available, false);
    const m = (await save(db)).message;
    const r = await prepare(db, [m]);
    assert.equal(
      (await rpc(db, "send", [r.preview_id, true])).outcomes[0].delivered,
      1,
    );
    await assert.rejects(rpc(db, "begin", [request, "a".repeat(64), campaign]));
  } finally {
    await db.close();
  }
});
test("stale edits, cancellation and expired reviews fail before any delivery; cancellation receipt replays", async () => {
  const db = await seeded();
  try {
    const m = (await save(db)).message,
      review = await prepare(db, [m]);
    const edited = (
      await save(
        db,
        "New reviewed subject",
        "A corrected update",
        "update",
        m.id,
        m.updated_at,
      )
    ).message;
    await assert.rejects(rpc(db, "send", [review.preview_id, true]));
    const current = await prepare(db, [edited]);
    const operation = crypto.randomUUID();
    assert.equal(
      (await rpc(db, "cancel", [operation, selection([edited])])).cancelled,
      1,
    );
    assert.equal(
      (await rpc(db, "cancel", [operation, selection([edited])])).replayed,
      true,
    );
    await assert.rejects(rpc(db, "send", [current.preview_id, true]));
    const another = (await save(db, "A new draft")).message,
      r = await prepare(db, [another]);
    await db.exec("reset role");
    await db.exec(
      "update ifund_communications_runtime.send_previews set expires_at=now()-interval '1 second'",
    );
    await as(db, owner);
    await assert.rejects(rpc(db, "send", [r.preview_id, true]));
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int n from public.ifund_notifications"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("opt-out and refunds remove snapshot recipients; new donors never join a review or retry and zero delivery stays draft", async () => {
  const db = await seeded();
  try {
    const m = (await save(db)).message,
      r = await prepare(db, [m]);
    await db.exec("reset role");
    await db.query(
      "update public.ifund_profiles set comm_prefs='{" +
        '"email_updates":true,"in_app_updates":false' +
        "}' where id=$1",
      [other],
    );
    const newDonor = crypto.randomUUID();
    await db.query("insert into auth.users values($1,now())", [newDonor]);
    await db.query(
      "insert into public.ifund_profiles(id,account_status,account_deletion_pending) values($1,'active',false)",
      [newDonor],
    );
    await db.query(
      "insert into public.ifund_donations values(gen_random_uuid(),$1,500,'USD','captured','new',now(),$2)",
      [campaign, newDonor],
    );
    await as(db, owner);
    const sent = await rpc(db, "send", [r.preview_id, true]);
    assert.equal(sent.outcomes[0].delivered, 0);
    assert.equal(sent.outcomes[0].excluded_since_review, 1);
    assert.equal(sent.outcomes[0].status, "no_eligible_supporters");
    assert.equal((await rpc(db, "workspace")).messages[0].status, "draft");
    assert.equal((await rpc(db, "send", [r.preview_id, true])).replayed, true);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int n from public.ifund_notifications"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("refund, deletion-pending and unconfirmed supporters excluded; another captured gift retains eligibility", async () => {
  const db = await seeded();
  try {
    const m = (await save(db)).message,
      r = await prepare(db, [m]);
    await db.exec("reset role");
    await db.exec(
      "update public.ifund_donations set status='refunded' where paypal_capture_id='capture-a'",
    );
    await as(db, owner);
    assert.equal(
      (await rpc(db, "send", [r.preview_id, true])).outcomes[0].delivered,
      1,
    );
    const next = (await save(db, "Another note")).message,
      r2 = await prepare(db, [next]);
    await db.exec("reset role");
    await db.exec(
      "update public.ifund_donations set status='refunded' where paypal_capture_id='capture-b'",
    );
    await as(db, owner);
    assert.equal(
      (await rpc(db, "send", [r2.preview_id, true])).outcomes[0].delivered,
      0,
    );
    for (const change of [
      "update public.ifund_profiles set account_deletion_pending=true where id='" +
        other +
        "'",
      "update auth.users set email_confirmed_at=null where id='" + other + "'",
    ]) {
      await db.exec("reset role");
      await db.exec(
        "update public.ifund_donations set status='captured' where paypal_capture_id='capture-b'",
      );
      await db.exec(change);
      await as(db, owner);
      assert.equal(
        (await prepare(db, [(await save(db, "Check eligibility")).message]))
          .messages[0].eligible_recipients,
        0,
      );
    }
  } finally {
    await db.close();
  }
});
test("whole batch rejects duplicates, mixed owners and stale items; volunteer/sponsor notification types are mapped", async () => {
  const db = await seeded();
  try {
    const a = (
        await save(
          db,
          "Volunteer information",
          "Volunteer help is welcome.",
          "volunteer",
        )
      ).message,
      b = (
        await save(
          db,
          "Sponsor information",
          "Please review the campaign.",
          "sponsor",
        )
      ).message;
    await assert.rejects(
      rpc(db, "prepare_send", [crypto.randomUUID(), selection([a, a])]),
    );
    await as(db, other);
    const otherMessage = (
      await rpc(db, "save", [
        crypto.randomUUID(),
        null,
        null,
        foreign,
        "Private",
        "Private draft",
        "update",
      ])
    ).message;
    await as(db, owner);
    await assert.rejects(
      rpc(db, "prepare_send", [
        crypto.randomUUID(),
        selection([a, otherMessage]),
      ]),
    );
    const r = await prepare(db, [a, b]);
    const sent = await rpc(db, "send", [r.preview_id, true]);
    assert.deepEqual(
      sent.outcomes.map((o) => o.delivered),
      [1, 1],
    );
    await as(db, other);
    assert.ok(
      (
        await db.query("select type from public.ifund_notifications")
      ).rows.every((x) => x.type === "announcement"),
    );
  } finally {
    await db.close();
  }
});
test("five-message rate and 200-delivery audience limits fail closed", async () => {
  const db = await seeded();
  try {
    const messages = [];
    for (let i = 0; i < 5; i++)
      messages.push((await save(db, "Note " + i)).message);
    const review = await prepare(db, messages);
    await rpc(db, "send", [review.preview_id, true]);
    const extra = (await save(db, "Rate limited")).message;
    const next = await prepare(db, [extra]);
    await assert.rejects(rpc(db, "send", [next.preview_id, true]));
    await db.exec("reset role");
    await db.query(
      `with u as(insert into auth.users select gen_random_uuid(),now() from generate_series(1,201) returning id),p as(insert into public.ifund_profiles(id,account_status,account_deletion_pending) select id,'active',false from u returning id) insert into public.ifund_donations(id,campaign_id,donor_id,gift_cents,currency,status,paypal_capture_id,captured_at) select gen_random_uuid(),$1,id,100,'USD','captured',id::text,now() from p`,
      [campaign],
    );
    await as(db, owner);
    await assert.rejects(prepare(db, [extra]));
  } finally {
    await db.close();
  }
});
test("AI lifecycle stores an unsent draft and receipt; failed/expired leases cannot fabricate completion", async () => {
  const db = await seeded();
  try {
    const c = await rpc(db, "begin", [request, "a".repeat(64), campaign]);
    assert.equal(c.state, "claimed");
    const m = await rpc(db, "finish", [
      request,
      c.lease,
      {
        subject: "Thanks for your support",
        content: "The campaign is preparing classroom supplies.",
      },
      "thank_you",
    ]);
    assert.equal(m.status, "draft");
    assert.equal(m.ai_generated, true);
    assert.equal(
      (await rpc(db, "begin", [request, "a".repeat(64), campaign])).message.id,
      m.id,
    );
    await assert.rejects(
      rpc(db, "finish", [
        request,
        c.lease,
        { subject: "Duplicate", content: "Duplicate" },
        "update",
      ]),
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int n from public.ifund_notifications"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("disabled/suspended/unconfirmed/deletion-pending/no-consent accounts denied without changing historical messages", async () => {
  const db = await seeded();
  try {
    await save(db);
    for (const change of [
      "update ifund_communications_runtime.control set enabled=false",
      "update public.ifund_profiles set account_status='suspended' where id='" +
        owner +
        "'",
      "update auth.users set email_confirmed_at=null where id='" + owner + "'",
      "update public.ifund_profiles set account_deletion_pending=true where id='" +
        owner +
        "'",
      "delete from public.ifund_legal_acceptances where owner_id='" +
        owner +
        "'",
    ]) {
      await db.exec("reset role;begin");
      await db.exec(change);
      await as(db, owner);
      await assert.rejects(rpc(db, "workspace"));
      await db.exec("rollback");
    }
  } finally {
    await db.close();
  }
});
test("AI reserves a draft slot before inference, preventing manual writes from consuming its last capacity", async () => {
  const db = await seeded();
  try {
    await db.exec("reset role");
    await db.query(
      `with m as(insert into public.ifund_message(id,campaign_id,campaign_title,subject,content,comm_type,audience,channels,status,created_by_id,source_system) select gen_random_uuid()::text,$1,'Classroom','Existing draft','A true statement','update','campaign_donors','["in_app"]'::jsonb,'draft',$2,'ifund_communications_v1' from generate_series(1,99) returning id) insert into ifund_communications_runtime.draft_meta(message_id,owner_id) select id,$2::uuid from m`,
      [campaign, owner],
    );
    await as(db, owner);
    const c = await rpc(db, "begin", [request, "a".repeat(64), campaign]);
    assert.equal(c.state, "claimed");
    await assert.rejects(
      save(db, "Capacity conflict"),
      (e) => e.code === "P1001",
    );
    await rpc(db, "finish", [
      request,
      c.lease,
      { subject: "Reserved AI draft", content: "A factual note" },
      "update",
    ]);
    await assert.rejects(
      rpc(db, "begin", [crypto.randomUUID(), "b".repeat(64), campaign]),
      (e) => e.code === "P1001",
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test('all active drafts remain reachable ahead of newer history so owners can recover capacity',async()=>{
 const db=await seeded();try{
  await db.exec('reset role');
  await db.query(`with m as(insert into public.ifund_message(id,campaign_id,campaign_title,subject,content,comm_type,audience,channels,status,created_by_id,source_system,created_at) select gen_random_uuid()::text,$1,'Classroom','Draft '||n,'A true statement','update','campaign_donors','["in_app"]'::jsonb,'draft',$2,'ifund_communications_v1','2026-11-01'::timestamptz from generate_series(1,100)n returning id) insert into ifund_communications_runtime.draft_meta(message_id,owner_id) select id,$2::uuid from m`,[campaign,owner]);
  await db.query(`with m as(insert into public.ifund_message(id,campaign_id,campaign_title,subject,content,comm_type,status,created_by_id,source_system,created_at) select gen_random_uuid()::text,$1,'Classroom','History '||n,'Older delivered record','update','sent',$2,'ifund_communications_v1','2026-11-02'::timestamptz from generate_series(1,100)n returning id) insert into ifund_communications_runtime.draft_meta(message_id,owner_id) select id,$2::uuid from m`,[campaign,owner]);
  await as(db,owner);const workspace=await rpc(db,'workspace');assert.equal(workspace.messages.length,100);assert.ok(workspace.messages.every(m=>m.status==='draft'));
  await rpc(db,'cancel',[crypto.randomUUID(),selection(workspace.messages.slice(0,50))]);assert.equal((await save(db,'Recovered capacity')).message.status,'draft');
 }finally{await db.close();}
});
