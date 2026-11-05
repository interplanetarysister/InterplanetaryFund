import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  communicationsInput,
  communicationsMessages,
  communicationsOutput,
  communicationsFormat,
  communicationsRoute,
  selectedMessages,
  messageFields,
} from "../worker/agents/communications.js";
const uid = "11111111-1111-4111-8111-111111111111",
  campaign = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  lease = "22222222-2222-4222-8222-222222222222";
const env = {
  IFUND_COMMUNICATIONS_ENABLED: "enabled",
  IFUND_COMMUNICATIONS_AI_ENABLED: "enabled",
  IFUND_COMMUNICATIONS_SEND_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
};
const input = {
  request_id: uid,
  campaign_id: campaign,
  details: "Please thank our supporters for their encouragement.",
  comm_type: "thank_you",
};
const context = {
  campaign: {
    id: campaign,
    title: "Classroom supplies",
    summary: "An organizer is gathering school supplies.",
    story: "Current truthful organizer statement",
    goal_amount: 500,
    status: "draft",
  },
  research: { available: false },
  recent_messages: [],
};
const http = (action, body) =>
  new Request("https://worker.test/api/agents/communications/" + action, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer test.token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("draft and owner-action requests reject recipient injection, authority flags, duplicate/stale selections and overlong content", () => {
  assert.equal(communicationsInput(input).comm_type, "thank_you");
  for (const extra of [
    { publish: true },
    { recipients: [uid] },
    { owner_id: uid },
  ])
    assert.throws(() => communicationsInput({ ...input, ...extra }));
  const item = { id: uid, revision: "2026-11-04T06:00:00.123456Z" };
  assert.equal(selectedMessages([item]).length, 1);
  assert.throws(() => selectedMessages([item, item]));
  assert.throws(() =>
    selectedMessages([{ ...item, revision: "not a revision" }]),
  );
  assert.throws(() =>
    messageFields({
      campaign_id: campaign,
      subject: "A subject",
      content: "x".repeat(4001),
      comm_type: "update",
    }),
  );
});
test("AI receives current campaign and bounded research/history, never recipients or fabricated financial milestones", () => {
  const messages = communicationsMessages(input, {
    ...context,
    donor_emails: ["PRIVATE"],
    research: { available: true, guidance: ["x".repeat(50000)] },
    recent_messages: [{ subject: "Old", content: "x".repeat(50000) }],
  });
  assert.ok(!JSON.stringify(messages).includes("PRIVATE"));
  assert.ok(
    new TextEncoder().encode(JSON.stringify(messages)).byteLength <= 24000,
  );
  assert.match(messages[0].content, /never infer a goal was reached/);
  assert.deepEqual(JSON.parse(messages[1].content).financial_milestones, {
    available: false,
  });
  assert.throws(() =>
    communicationsMessages({ ...input, campaign_id: uid }, context),
  );
});
test("output normalizes only unsent subject/content and rejects malformed/control-character results", () => {
  assert.deepEqual(
    communicationsOutput({
      response: {
        subject: " Hello ",
        content: " A truthful note ",
        sent: true,
        recipients: [uid],
      },
    }),
    { subject: "Hello", content: "A truthful note" },
  );
  assert.throws(() => communicationsOutput("bad json"));
  assert.throws(() =>
    communicationsOutput({
      response: { subject: "Hello", content: "Bad\u0000text" },
    }),
  );
  assert.equal(communicationsFormat().json_schema.additionalProperties, false);
});
test("Worker validates identity, reserves once and requires stored draft receipt; no send tool is exposed to AI", async () => {
  const calls = [];
  let runs = 0;
  const fetcher = async (url, init) => {
    calls.push([url, init.body ? JSON.parse(init.body) : null]);
    return Response.json(
      url.endsWith("/user")
        ? { id: uid, email_confirmed_at: "today" }
        : url.endsWith("_context")
          ? context
          : url.endsWith("_begin")
            ? { state: "claimed", lease }
            : {
                id: lease,
                subject: "Thank you",
                content: "Thanks for your encouragement.",
                status: "draft",
              },
    );
  };
  const r = await communicationsRoute(
    http("drafts", input),
    {
      ...env,
      AI: {
        run: async (model, options) => {
          runs++;
          assert.ok(!("tools" in options));
          return {
            response: {
              subject: "Thank you",
              content: "Thanks for your encouragement.",
            },
          };
        },
      },
    },
    fetcher,
  );
  assert.equal(r.status, 201);
  assert.equal(runs, 1);
  assert.equal(
    calls.at(-1)[1].p_result.content,
    "Thanks for your encouragement.",
  );
  assert.ok(calls.every((c) => !c[0].endsWith("_send")));
  assert.equal((await r.json()).message.status, "draft");
});
test("inference replay, quota and previous failure do not call the model", async () => {
  for (const state of [
    "completed",
    "limited",
    "in_progress",
    "failed",
    "conflict",
  ]) {
    let runs = 0;
    const fetcher = async (url) =>
      Response.json(
        url.endsWith("/user")
          ? { id: uid, email_confirmed_at: "today" }
          : url.endsWith("_context")
            ? context
            : { state, message: { id: lease, status: "draft" } },
      );
    const r = await communicationsRoute(
      http("drafts", input),
      {
        ...env,
        AI: {
          run: async () => {
            runs++;
          },
        },
      },
      fetcher,
    );
    assert.equal(runs, 0);
    assert.equal(
      r.status,
      state === "completed" ? 200 : state === "limited" ? 429 : 409,
    );
  }
});
test("failed inference consumes the attempt and never reports a sent message", async () => {
  let finish;
  const fetcher = async (url, init) => {
    if (url.endsWith("_finish")) finish = JSON.parse(init.body);
    return Response.json(
      url.endsWith("/user")
        ? { id: uid, email_confirmed_at: "today" }
        : url.endsWith("_context")
          ? context
          : url.endsWith("_begin")
            ? { state: "claimed", lease }
            : { status: "failed" },
    );
  };
  const r = await communicationsRoute(
    http("drafts", input),
    { ...env, AI: { run: async () => ({ response: "not JSON" }) } },
    fetcher,
  );
  assert.equal(r.status, 502);
  assert.equal(finish.p_result, null);
  assert.equal((await r.json()).code, "new_request_required");
});
test("sending requires a current owner review and explicit runtime enablement, never browser recipients", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push([url, init.body ? JSON.parse(init.body) : null]);
    return Response.json(
      url.endsWith("/user")
        ? { id: uid, email_confirmed_at: "today" }
        : { outcomes: [], replayed: false },
    );
  };
  assert.equal(
    (
      await communicationsRoute(
        http("send", { preview_id: uid, confirm_owner_review: false }),
        env,
        fetcher,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await communicationsRoute(
        http("send", {
          preview_id: uid,
          confirm_owner_review: true,
          recipients: [lease],
        }),
        env,
        fetcher,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await communicationsRoute(
        http("send", { preview_id: uid, confirm_owner_review: true }),
        { ...env, IFUND_COMMUNICATIONS_SEND_ENABLED: "disabled" },
        fetcher,
      )
    ).status,
    503,
  );
  const r = await communicationsRoute(
    http("send", { preview_id: uid, confirm_owner_review: true }),
    env,
    fetcher,
  );
  assert.equal(r.status, 200);
  assert.deepEqual(calls.at(-1)[1], {
    p_preview_id: uid,
    p_confirm_owner_review: true,
  });
});
test("manual drafting remains independent of AI binding and uses an operation receipt", async () => {
  let saved;
  const fetcher = async (url, init) => {
    if (url.endsWith("_save")) saved = JSON.parse(init.body);
    return Response.json(
      url.endsWith("/user")
        ? { id: uid, email_confirmed_at: "today" }
        : { message: { id: lease, status: "draft" } },
    );
  };
  const r = await communicationsRoute(
    http("save", {
      operation_id: uid,
      message_id: null,
      revision: null,
      campaign_id: campaign,
      subject: "An update",
      content: "A truthful update",
      comm_type: "update",
    }),
    { ...env, IFUND_COMMUNICATIONS_AI_ENABLED: "disabled" },
    fetcher,
  );
  assert.equal(r.status, 200);
  assert.equal(saved.p_operation_id, uid);
});
test("raw provider/SQL errors are not exposed and unauthenticated/oversized requests fail closed", async () => {
  assert.equal(
    (
      await communicationsRoute(
        new Request("https://worker.test/api/agents/communications/workspace"),
        env,
      )
    ).status,
    401,
  );
  const fetcher = async (url) =>
    url.endsWith("/user")
      ? Response.json({ id: uid, email_confirmed_at: "today" })
      : Response.json(
          { message: "SECRET SQL", code: "XX000" },
          { status: 500 },
        );
  const r = await communicationsRoute(http("workspace"), env, fetcher);
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes("SECRET"));
  const huge = http("save", { content: "x".repeat(40000) });
  assert.equal(
    (
      await communicationsRoute(huge, env, async () =>
        Response.json({ id: uid, email_confirmed_at: "today" }),
      )
    ).status,
    413,
  );
});
test("Cloudflare entrypoint ignores execution context and preview masks send/AI availability", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (url) =>
      Response.json(
        url.endsWith("/user")
          ? { id: uid, email_confirmed_at: "today" }
          : {
              messages: [],
              campaigns: [],
              delivery_available: true,
              ai_available: true,
            },
      );
    const r = await worker.fetch(
      http("workspace"),
      {
        ...env,
        IFUND_COMMUNICATIONS_SEND_ENABLED: "disabled",
        IFUND_COMMUNICATIONS_AI_ENABLED: "disabled",
      },
      { waitUntil() {} },
    );
    assert.equal(r.status, 200);
    const w = await r.json();
    assert.equal(w.delivery_available, false);
    assert.equal(w.ai_available, false);
  } finally {
    globalThis.fetch = previous;
  }
});
test("full draft capacity rejects before inference and explains cancelling old drafts", async () => {
  let runs = 0;
  const fetcher = async (url) =>
    url.endsWith("_begin")
      ? Response.json({ code: "P1001" }, { status: 400 })
      : Response.json(
          url.endsWith("/user")
            ? { id: uid, email_confirmed_at: "today" }
            : context,
        );
  const r = await communicationsRoute(
    http("drafts", input),
    {
      ...env,
      AI: {
        run: async () => {
          runs++;
        },
      },
    },
    fetcher,
  );
  assert.equal(r.status, 429);
  assert.equal(runs, 0);
  assert.match((await r.json()).error, /Cancel some drafts/);
});
