import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, as } from "./fixtures/storyDatabase.js";
import { allServicePositions } from "../worker/services/catalog.js";
import { storyRoute } from "../worker/agents/story.js";
import { serviceGateway } from "../worker/services/gateway.js";

const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const rid = "33333333-3333-4333-8333-333333333333",
  rid2 = "44444444-4444-4444-8444-444444444444",
  rid3 = "55555555-5555-4555-8555-555555555555";
const secret = "e".repeat(64),
  hash = "a".repeat(64),
  task = { details: "Our community needs school supplies.", section: null };
const result = {
  titles: ["A", "B", "C", "D", "E"],
  summaries: ["One summary", "Another summary"],
  story: "A true story",
  image_prompt: "Mission-specific image",
};
async function setup({ enabled = true, tested = true } = {}) {
  const db = await fixture({ workforce: true });
  assert.equal(
    (await db.query("select count(*) n from ifund_ops.service_positions"))
      .rows[0].n,
    allServicePositions().length,
  );
  await db.query(
    "update ifund_ops.workforce_control set enabled=$1,free_plan_verified_until=now()+interval '1 day',free_plan_evidence='test free account',worker_secret_sha256=encode(sha256(convert_to($2,'UTF8')),'hex')",
    [enabled, secret],
  );
  await db.query(
    `insert into ifund_ops.workforce_implementations(id,revision,provider,adapter,model,available,tested,assigned_positions,capabilities,tested_capabilities,reservation_units,cost,evaluation)
    values('writer_v1','1','cloudflare','workers_ai','@cf/meta/llama-3.3-70b-instruct-fp8-fast',true,$1,'{story_agent}','{story.draft.v1,story.section.v1}','{story.draft.v1,story.section.v1}',1200,
    jsonb_build_object('verified',true,'additional_cost',0,'trial',false,'hard_stop',true,'evidence','official free terms','expires_at',now()+interval '1 day'),
    jsonb_build_object('passed',true,'revision','1','evidence','contract validation','expires_at',now()+interval '1 day'))`,
    [tested],
  );
  await actor(db, uid);
  return db;
}
async function actor(db, id, key = secret) {
  await as(db, id);
  await db.query("select set_config('request.headers',$1,false)", [
    JSON.stringify(key ? { "x-ifund-workforce-key": key } : {}),
  ]);
}
async function begin(db, id = rid, impl = "writer_v1", changes = {}) {
  const input = {
    hash,
    campaign: null,
    contract: "story.draft.v1",
    bytes: 4000,
    task,
    ...changes,
  };
  return (
    await db.query(
      "select public.ifund_workforce_begin($1,$2,$3,$4,$5,$6,$7) r",
      [
        id,
        input.hash,
        input.campaign,
        impl,
        input.contract,
        input.bytes,
        input.task,
      ],
    )
  ).rows[0].r;
}
async function start(db, id, lease) {
  return (
    await db.query("select public.ifund_workforce_started($1,$2) r", [
      id,
      lease,
    ])
  ).rows[0].r;
}
async function finish(
  db,
  id,
  lease,
  payload = result,
  outcome = payload ? "succeeded" : "unknown",
) {
  return (
    await db.query("select public.ifund_workforce_finish($1,$2,$3,$4) r", [
      id,
      lease,
      payload,
      outcome,
    ])
  ).rows[0].r;
}

test("dormant and untested implementations cannot dispatch or manufacture operational state", async () => {
  const db = await setup({ enabled: false });
  try {
    assert.equal((await begin(db)).state, "unavailable");
    await db.exec(
      "reset role; update ifund_ops.workforce_control set enabled=true; update ifund_ops.workforce_implementations set tested=false",
    );
    await actor(db, uid);
    assert.equal((await begin(db)).state, "queued");
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*) n from ifund_ops.workforce_assignments"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("server execution key, confirmed active member and owner permission are required independently", async () => {
  const db = await setup();
  try {
    for (const key of [null, "f".repeat(64)]) {
      await actor(db, uid, key);
      await assert.rejects(begin(db), /Verified executor required/);
      await assert.rejects(
        db.query("select public.ifund_workforce_snapshot()"),
        /Verified executor required/,
      );
    }
    await actor(db, null);
    await assert.rejects(begin(db), /Member access required/);
    await actor(db, uid);
    await assert.rejects(
      begin(db, rid, "writer_v1", { campaign: other }),
      /Owned campaign required/,
    );
    await db.exec("reset role");
    await db.query(
      "update public.ifund_profiles set account_status='suspended' where id=$1",
      [uid],
    );
    await actor(db, uid);
    await assert.rejects(begin(db), /Member access required/);
  } finally {
    await db.close();
  }
});

test("immutable identities, assignment history, model replacement and successful receipt replay", async () => {
  const db = await setup();
  try {
    const claim = await begin(db);
    assert.equal(claim.state, "claimed");
    assert.equal(await start(db, rid, claim.lease), true);
    await assert.rejects(start(db, rid, claim.lease), /already dispatched/);
    const receipt = await finish(db, rid, claim.lease);
    assert.equal(receipt.status, "draft");
    const replay = await begin(db);
    assert.equal(replay.state, "completed");
    assert.equal(replay.draft.id, receipt.id);
    assert.equal(
      (await begin(db, rid, "writer_v1", { hash: "b".repeat(64) })).state,
      "conflict",
    );
    assert.equal(
      (
        await begin(db, rid, "writer_v1", {
          task: { ...task, details: "Other details using same hash." },
        })
      ).state,
      "conflict",
    );
    await db.exec("reset role");
    await assert.rejects(
      db.exec(
        "update ifund_ops.service_positions set title='New Title' where id='story_agent'",
      ),
      /identity is immutable/,
    );
    await assert.rejects(
      db.exec("delete from ifund_ops.service_positions where id='story_agent'"),
      /cannot be deleted/,
    );
    await assert.rejects(
      db.exec(
        "update ifund_ops.workforce_implementations set model='different' where id='writer_v1'",
      ),
      /new implementation revision/,
    );
    const rows = (
      await db.query(
        "select a.position_id,a.implementation_revision,a.status,i.successful_runs from ifund_ops.workforce_assignments a join ifund_ops.workforce_implementations i on i.id=a.implementation_id",
      )
    ).rows;
    assert.deepEqual(rows, [
      {
        position_id: "story_agent",
        implementation_revision: "1",
        status: "succeeded",
        successful_runs: 1,
      },
    ]);
  } finally {
    await db.close();
  }
});

test("quota exhaustion queues once, preserves context, and resumes the same job after free capacity returns", async () => {
  const db = await setup();
  try {
    const first = await begin(db);
    await finish(db, rid, first.lease, null);
    const second = await begin(db, rid2);
    await finish(db, rid2, second.lease, null);
    const waiting = await begin(db, rid3);
    assert.equal(waiting.state, "queued");
    assert.equal((await begin(db, rid3)).state, "queued");
    const queue = (await db.query("select public.ifund_workforce_queued() r"))
      .rows[0].r;
    assert.equal(queue.length, 1);
    assert.deepEqual(queue[0].task, task);
    await db.exec(
      "reset role; update ifund_ops.workforce_assignments set assigned_at=now()-interval '1 day'; update ifund_ops.workflow_jobs set created_at=now()-interval '1 day' where status<>'paused'",
    );
    await actor(db, uid);
    const resumed = await begin(db, rid3);
    assert.equal(resumed.state, "claimed");
    await start(db, rid3, resumed.lease);
    await finish(db, rid3, resumed.lease);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select count(*) n from ifund_ops.workflow_jobs where source_event_id=$1",
          [uid + ":" + rid3],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*) n from ifund_ops.workflow_execution_log where event_type='capacity_wait'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

test("member cannot forge completions, steal leases, inspect private records or view another queue", async () => {
  const db = await setup();
  try {
    const claim = await begin(db);
    await actor(db, uid, null);
    await assert.rejects(
      finish(db, rid, claim.lease),
      /Verified executor required/,
    );
    await actor(db, other);
    await assert.rejects(finish(db, rid, claim.lease), /Invalid assignment/);
    await assert.rejects(
      db.query("select * from ifund_ops.workforce_assignments"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.ifund_workforce_admin_status()"),
      /Verified administrator required/,
    );
    await actor(db, uid);
    await begin(db, rid2, null);
    await actor(db, other);
    assert.deepEqual(
      (await db.query("select public.ifund_workforce_queued() r")).rows[0].r,
      [],
    );
  } finally {
    await db.close();
  }
});

test("expired leases and provider uncertainty cannot retry inference or refund consumed capacity", async () => {
  const db = await setup();
  try {
    const claim = await begin(db);
    await start(db, rid, claim.lease);
    await db.exec(
      "reset role; update ifund_ops.workflow_jobs set lease_until=now()-interval '1 second'",
    );
    await actor(db, uid);
    assert.equal((await begin(db)).state, "failed");
    await assert.rejects(
      finish(db, rid, claim.lease),
      /Invalid assignment|Invalid lease/,
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select status from ifund_ops.workforce_assignments"))
        .rows[0].status,
      "unknown",
    );
    assert.equal(
      (
        await db.query(
          "select reserved_units from ifund_ops.workforce_capacity_days",
        )
      ).rows[0].reserved_units,
      1200,
    );
  } finally {
    await db.close();
  }
});

test("free cost/evaluation evidence and account attestation are rechecked atomically at assignment", async () => {
  const db = await setup();
  try {
    await db.exec(
      "reset role; update ifund_ops.workforce_implementations set cost=jsonb_set(cost,'{additional_cost}','1')",
    );
    await actor(db, uid);
    assert.equal((await begin(db)).state, "queued");
    await db.exec(
      "reset role; update ifund_ops.workforce_control set free_plan_verified_until=now()-interval '1 second'",
    );
    await actor(db, uid);
    assert.equal((await begin(db, rid2)).state, "unavailable");
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*) n from ifund_ops.workforce_assignments"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("queued private text can be erased only by its owner even after plan and execution expiry", async () => {
  const db = await setup();
  try {
    assert.equal((await begin(db, rid, null)).state, "queued");
    await actor(db, other, null);
    await assert.rejects(
      db.query("select public.ifund_workforce_cancel_queued($1)", [rid]),
      /Queued request unavailable/,
    );
    await db.exec(
      "reset role; update ifund_ops.workforce_control set enabled=false; update ifund_access.member_entitlements set verified_at=now()-interval '2 days',valid_until=now()-interval '1 day'",
    );
    await actor(db, uid, null);
    assert.equal(
      (await db.query("select public.ifund_workforce_queued() r")).rows[0].r
        .length,
      1,
    );
    const cancelled = (
      await db.query("select public.ifund_workforce_cancel_queued($1) r", [rid])
    ).rows[0].r;
    assert.equal(cancelled.status, "cancelled");
    await db.exec("reset role");
    const row = (
      await db.query("select status,payload from ifund_ops.workflow_jobs")
    ).rows[0];
    assert.equal(row.status, "cancelled");
    assert.equal(row.payload.task, undefined);
    assert.ok(row.payload.input_hash);
    assert.ok(row.payload.draft_id);
  } finally {
    await db.close();
  }
});

test("queued requests cannot disable the legacy path, while resumed assignments still consume its daily limit", async () => {
  const db = await setup();
  try {
    assert.equal((await begin(db, rid, null)).state, "queued");
    assert.equal((await begin(db, rid2, null)).state, "queued");
    const legacy = (
      await db.query("select public.ifund_story_begin($1,$2,null) r", [
        rid3,
        hash,
      ])
    ).rows[0].r;
    assert.equal(legacy.state, "claimed");
    await db.exec(
      "reset role; update ifund_ops.workflow_jobs set created_at=now()-interval '1 day' where status='paused'",
    );
    await actor(db, uid);
    assert.equal((await begin(db, rid)).state, "claimed");
    const limited = (
      await db.query("select public.ifund_story_begin($1,$2,null) r", [
        "66666666-6666-4666-8666-666666666666",
        hash,
      ])
    ).rows[0].r;
    assert.equal(limited.state, "limited");
  } finally {
    await db.close();
  }
});

test("erasing unexecuted queue requests does not consume inference capacity", async () => {
  const db = await setup();
  try {
    for (const id of [rid, rid2]) {
      assert.equal((await begin(db, id, null)).state, "queued");
      await db.query("select public.ifund_workforce_cancel_queued($1)", [id]);
    }
    assert.equal((await begin(db, rid3)).state, "claimed");
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*) n from ifund_ops.workforce_assignments"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select reserved_units from ifund_ops.workforce_capacity_days",
        )
      ).rows[0].reserved_units,
      1200,
    );
  } finally {
    await db.close();
  }
});

test("preview-only authorization never enables production or permits cross-environment task reuse", async () => {
  const db = await setup();
  const previewSecret = "f".repeat(64);
  try {
    const production = await begin(db);
    assert.equal(production.state, "claimed");
    await db.exec("reset role");
    await db.query(
      "update ifund_ops.workforce_control set enabled=false,preview_enabled=true,preview_worker_secret_sha256=encode(sha256(convert_to($1,'UTF8')),'hex')",
      [previewSecret],
    );
    await actor(db, uid, secret);
    assert.equal((await begin(db, rid2)).state, "unavailable");
    const productionSnapshot = (
      await db.query("select public.ifund_workforce_snapshot() r")
    ).rows[0].r;
    assert.equal(productionSnapshot.environment, "production");
    assert.equal(productionSnapshot.policy.enabled, false);
    await actor(db, uid, previewSecret);
    assert.equal((await begin(db)).state, "conflict");
    await assert.rejects(start(db, rid, production.lease), /environment/);
    await assert.rejects(finish(db, rid, production.lease), /environment/);
    const preview = await begin(db, rid2);
    assert.equal(preview.state, "claimed");
    await start(db, rid2, preview.lease);
    await finish(db, rid2, preview.lease);
    assert.equal((await begin(db, rid3)).state, "queued");
    await db.exec(
      "reset role;update ifund_ops.workforce_control set enabled=true,preview_enabled=false",
    );
    await actor(db, uid, secret);
    assert.equal((await begin(db, rid3)).state, "conflict");
    await actor(db, uid, previewSecret);
    const blocked = (
      await db.query("select public.ifund_workforce_snapshot() r")
    ).rows[0].r;
    assert.equal(blocked.environment, "preview");
    assert.equal(blocked.policy.enabled, false);
    await db.exec("reset role");
    assert.deepEqual(
      (
        await db.query(
          "select environment from ifund_ops.workforce_assignments order by id",
        )
      ).rows.map((r) => r.environment),
      ["production", "preview"],
    );
    await assert.rejects(
      db.exec(
        "update ifund_ops.workforce_control set preview_worker_secret_sha256=worker_secret_sha256",
      ),
      /check constraint/,
    );
  } finally {
    await db.close();
  }
});

test("untagged historical jobs are production and cannot be replayed by a preview executor", async () => {
  const db = await setup();
  const previewSecret = "f".repeat(64);
  try {
    const legacy = (
      await db.query("select public.ifund_story_begin($1,$2,null) r", [
        rid,
        hash,
      ])
    ).rows[0].r;
    await db.query("select public.ifund_story_finish($1,$2,$3)", [
      rid,
      legacy.lease,
      result,
    ]);
    await db.exec("reset role");
    await db.query(
      "update ifund_ops.workforce_control set enabled=false,preview_enabled=true,preview_worker_secret_sha256=encode(sha256(convert_to($1,'UTF8')),'hex')",
      [previewSecret],
    );
    await actor(db, uid, previewSecret);
    assert.equal((await begin(db)).state, "conflict");
  } finally {
    await db.close();
  }
});

async function isolatedPreview(db) {
  const previewSecret = "f".repeat(64);
  await db.exec(
    "reset role; update ifund_story_runtime.control set enabled=false",
  );
  await db.query(
    "update ifund_ops.workforce_control set enabled=false,preview_enabled=true,preview_worker_secret_sha256=encode(sha256(convert_to($1,'UTF8')),'hex')",
    [previewSecret],
  );
  await actor(db, uid, previewSecret);
  return previewSecret;
}

test("isolated preview can read owned context while both production writing gates remain off", async () => {
  const db = await setup();
  try {
    const previewSecret = await isolatedPreview(db);
    assert.ok(
      (await db.query("select public.ifund_story_context(null) r")).rows[0].r,
    );
    for (const key of [null, secret, "b".repeat(64)]) {
      await actor(db, uid, key);
      await assert.rejects(
        db.query("select public.ifund_story_context(null)"),
        /Story preview disabled/,
      );
    }
    await actor(db, uid, previewSecret);
    await assert.rejects(
      db.query("select public.ifund_story_context($1)", [other]),
      /Owned campaign required/,
    );
    await db.exec("reset role");
    assert.deepEqual(
      (
        await db.query(
          "select (select enabled from ifund_story_runtime.control) story,enabled production,preview_enabled preview from ifund_ops.workforce_control",
        )
      ).rows[0],
      { story: false, production: false, preview: true },
    );
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        (
          await db.query(
            "select has_function_privilege($1,'ifund_workforce_runtime.story_preview_enabled()','EXECUTE') allowed",
            [role],
          )
        ).rows[0].allowed,
        false,
      );
    }
  } finally {
    await db.close();
  }
});

test("preview proof never substitutes for confirmed identity, active account, agreement or entitlement", async () => {
  const db = await setup();
  try {
    const previewSecret = await isolatedPreview(db);
    const cases = [
      [
        "update auth.users set email_confirmed_at=null where id=$1",
        "update auth.users set email_confirmed_at=now() where id=$1",
      ],
      [
        "update public.ifund_profiles set account_status='suspended' where id=$1",
        "update public.ifund_profiles set account_status='active' where id=$1",
      ],
      [
        "update public.ifund_profiles set account_deletion_pending=true where id=$1",
        "update public.ifund_profiles set account_deletion_pending=false where id=$1",
      ],
      [
        "update public.ifund_legal_acceptances set explicit_consent=false where owner_id=$1",
        "update public.ifund_legal_acceptances set explicit_consent=true where owner_id=$1",
      ],
      [
        "update ifund_access.member_entitlements set status='expired' where owner_id=$1",
        "update ifund_access.member_entitlements set status='active' where owner_id=$1",
      ],
    ];
    for (const [disable, restore] of cases) {
      await db.exec("reset role");
      await db.query(disable, [uid]);
      await actor(db, uid, previewSecret);
      await assert.rejects(
        db.query("select public.ifund_story_context(null)"),
        /Member access required|Eligible AI plan required/,
      );
      await db.exec("reset role");
      await db.query(restore, [uid]);
    }
    await actor(db, null, previewSecret);
    await assert.rejects(
      db.query("select public.ifund_story_context(null)"),
      /Story preview disabled|Member access required/,
    );
  } finally {
    await db.close();
  }
});

test("expired or disabled preview access stops context and dispatch without enabling a legacy fallback", async () => {
  const db = await setup();
  try {
    const previewSecret = await isolatedPreview(db);
    for (const disable of [
      "update ifund_ops.workforce_control set preview_enabled=false",
      "update ifund_ops.workforce_control set free_plan_verified_until=now()-interval '1 second'",
      "update ifund_ops.workforce_control set free_plan_evidence=''",
    ]) {
      await db.exec("reset role");
      await db.exec(disable);
      await actor(db, uid, previewSecret);
      await assert.rejects(
        db.query("select public.ifund_story_context(null)"),
        /Story preview disabled/,
      );
      await assert.rejects(begin(db), /Story preview disabled/);
      // Owner erasure/recovery is deliberately independent of native eligibility.
      assert.deepEqual(
        (await db.query("select public.ifund_workforce_queued() r")).rows[0].r,
        [],
      );
      await db.exec(
        "reset role; update ifund_ops.workforce_control set preview_enabled=true,free_plan_verified_until=now()+interval '1 day',free_plan_evidence='verified test account'",
      );
    }
    assert.equal(
      (await db.query("select count(*) n from ifund_ops.workforce_assignments"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("permanent gateway carries preview proof through real database context, assignment and receipt replay", async () => {
  const db = await setup();
  try {
    const previewSecret = await isolatedPreview(db);
    let inference = 0;
    const apiFetch = async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer fixture.owner.jwt");
      if (url.endsWith("/auth/v1/user"))
        return Response.json({ id: uid, email_confirmed_at: "2026-01-01" });
      const name = url.split("/").pop();
      const payload = JSON.parse(init.body);
      const args = {
        ifund_story_context: [payload.p_campaign_id],
        ifund_workforce_snapshot: [],
        ifund_workforce_begin: [
          payload.p_request_id,
          payload.p_input_hash,
          payload.p_campaign_id,
          payload.p_implementation_id,
          payload.p_contract,
          payload.p_prompt_bytes,
          payload.p_task,
        ],
        ifund_workforce_started: [payload.p_request_id, payload.p_lease],
        ifund_workforce_finish: [
          payload.p_request_id,
          payload.p_lease,
          payload.p_result,
          payload.p_outcome,
        ],
      }[name];
      assert.ok(args, "Known fixture RPC only");
      await actor(db, uid, init.headers["x-ifund-workforce-key"] || null);
      try {
        const row = await db.query(
          `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
          args,
        );
        return Response.json(row.rows[0].r);
      } catch (error) {
        return Response.json({ message: error.message }, { status: 403 });
      }
    };
    const workerEnv = {
      SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
      IFUND_STORY_ENABLED: "enabled",
      IFUND_STORY_AI_ENABLED: "enabled",
      IFUND_WORKFORCE_ENABLED: "enabled",
      IFUND_WORKFORCE_ENVIRONMENT: "preview",
      IFUND_WORKFORCE_EXECUTOR_KEY: previewSecret,
      AI: {
        run: async (_model, input) => {
          inference++;
          assert.ok(!JSON.stringify(input).includes(previewSecret));
          assert.ok(!JSON.stringify(input).includes("fixture.owner.jwt"));
          return { response: result };
        },
      },
    };
    const request = () =>
      new Request("https://ifund.test/api/services/story_agent/drafts", {
        method: "POST",
        headers: {
          authorization: "Bearer fixture.owner.jwt",
          "content-type": "application/json",
          "x-ifund-workforce-key": "untrusted-client-value",
        },
        body: JSON.stringify({ ...task, request_id: rid }),
      });
    const env = {
      IFUND_STORY_AGENT: { fetch: (r) => storyRoute(r, workerEnv, apiFetch) },
    };
    const response = await serviceGateway(request(), env);
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.draft.status, "draft");
    assert.deepEqual(body.draft.payload.titles, result.titles);
    assert.ok(!JSON.stringify(body).includes(previewSecret));
    const replay = await serviceGateway(request(), env);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).draft.id, body.draft.id);
    assert.equal(inference, 1);
    await db.exec("reset role");
    assert.deepEqual(
      (
        await db.query(
          "select environment,status from ifund_ops.workforce_assignments",
        )
      ).rows,
      [{ environment: "preview", status: "succeeded" }],
    );
    assert.equal(
      (await db.query("select enabled from ifund_story_runtime.control"))
        .rows[0].enabled,
      false,
    );
    assert.equal(
      (await db.query("select enabled from ifund_ops.workforce_control"))
        .rows[0].enabled,
      false,
    );
    assert.equal(
      (await db.query("select count(*) n from public.ifund_campaigns")).rows[0]
        .n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("operator preview permission probe selects a consenting identity and rolls back every temporary control", async () => {
  const db = await setup();
  try {
    await isolatedPreview(db);
    await db.exec("reset role");
    // Match PostgREST claim resolution for this operator-probe fixture. The
    // first eligible identity lacks consent; a later eligible identity has it.
    await db.exec(
      "create or replace function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('test.uid',true),''))::uuid $$",
    );
    await db.query(
      "delete from public.ifund_legal_acceptances where owner_id=$1",
      [uid],
    );
    const before = (
      await db.query("select to_jsonb(c) r from ifund_ops.workforce_control c")
    ).rows[0].r;
    await db.exec(
      readFileSync(
        new URL(
          "../scripts/verify-isolated-story-preview.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const report = (
      await db.query(
        "select current_setting('ifund.story_preview_probe_result')::jsonb r",
      )
    ).rows[0].r;
    assert.equal(report.status, "PASS");
    assert.equal(report.checks.length, 8);
    assert.equal(report.persisted_control_or_key_changes, 0);
    assert.equal(report.member_execution_receipt, false);
    assert.deepEqual(
      (
        await db.query(
          "select to_jsonb(c) r from ifund_ops.workforce_control c",
        )
      ).rows[0].r,
      before,
    );
  } finally {
    await db.close();
  }
});
