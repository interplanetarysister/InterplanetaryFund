import test from "node:test";
import assert from "node:assert/strict";
import { strategyRoute } from "../worker/agents/strategy.js";
import { growthRoute } from "../worker/agents/growth.js";
import { communicationsRoute } from "../worker/agents/communications.js";
import { handleManagedConnections } from "../worker/agents/managedConnections.js";
import { specialistReferences, withSpecialistReferences, recordSpecialistReply } from "../worker/agents/specialistContext.js";

const owner = "11111111-1111-4111-8111-111111111111";
const campaign = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const lease = "44444444-4444-4444-8444-444444444444";
const env = {
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test",
  IFUND_STRATEGY_ENABLED: "enabled", IFUND_STRATEGY_AI_ENABLED: "enabled",
  IFUND_GROWTH_ENABLED: "enabled", IFUND_GROWTH_AI_ENABLED: "enabled",
  IFUND_COMMUNICATIONS_ENABLED: "enabled", IFUND_COMMUNICATIONS_AI_ENABLED: "enabled",
  IFUND_CONNECTIONS_ENABLED: "enabled",
};
const agents = [
  { name: "strategy", route: strategyRoute, action: "brief", permission: "allow_ai_campaign_drafts" },
  { name: "growth", route: growthRoute, action: "brief", permission: "allow_ai_campaign_drafts" },
  { name: "communications", route: communicationsRoute, action: "drafts", permission: "allow_ai_outreach_drafts" },
];
function http(agent, action, body) {
  return new Request(`https://ifund.test/api/agents/${agent}/${action}`, {
    method: body ? "POST" : "GET", headers: { authorization: "Bearer verified.owner", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function input(agent) {
  return agent === "communications"
    ? { request_id: requestId, campaign_id: campaign, details: "A truthful supporter update", comm_type: "update" }
    : { request_id: requestId, objective: "A truthful campaign plan", campaign_ids: [campaign] };
}
const campaignContext = { id: campaign, title: "Our current campaign" };
const context = { campaigns: [campaignContext], campaign: campaignContext };
function service({ preferences, anonymous = false, malformed = "", claims = { state: "claimed", lease } } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.Authorization, "Bearer verified.owner");
    if (malformed && url.includes(malformed)) return new Response("not JSON");
    if (url.endsWith("/rpc/ifund_current_account_is_active")) return Response.json(true);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: owner, is_anonymous: anonymous, email_confirmed_at: "2026-11-01" });
    if (url.includes("/ifund_ai_permission_preferences?")) return Response.json(preferences ?? [{ owner_id:owner,allow_ai_campaign_drafts:true,allow_ai_outreach_drafts:true,allow_future_internal_ai_assistance:true }]);
    if (url.endsWith("_context")) return Response.json(context);
    if (url.endsWith("_begin")) return Response.json(claims);
    if (url.endsWith("_workspace")) return Response.json({ brief: null, recommendations: [], messages: [], campaigns: [], ai_available: true });
    if (url.endsWith("_finish")) return Response.json({ brief: { summary: "Saved report" }, recommendations: [], id: lease, status: "draft" });
    throw Error("Unexpected test endpoint");
  };
  return { fetcher, calls };
}

test("all specialist generation checks current saved AI permission before context, quota or inference", async () => {
  for (const agent of agents) for (const preferences of [[], [{}], [{ [agent.permission]: false }], [{ [agent.permission]: true }, { [agent.permission]: true }]]) {
    const backend = service({ preferences });
    const response = await agent.route(http(agent.name, agent.action, input(agent.name)), {
      ...env, AI: { run: () => assert.fail("revoked inference") },
    }, backend.fetcher);
    assert.equal(response.status, 403, agent.name);
    assert.equal(backend.calls.length, 3);
    assert.match(backend.calls[2].url, /select=owner_id,allow_ai_campaign_drafts,allow_ai_outreach_drafts,allow_future_internal_ai_assistance/);
  }
});

test("an anonymous identity with a confirmation-like field cannot enter any specialist", async () => {
  for (const agent of [...agents, { name: "connections", route: handleManagedConnections }]) {
    const backend = service({ anonymous: true });
    const response = await agent.route(http(agent.name, "workspace"), env, backend.fetcher);
    assert.equal(response.status, 401);
    assert.equal(backend.calls.length, 1);
  }
});

test("workspace AI readiness requires a model binding, separate flag and current owner choice", async () => {
  for (const agent of agents) {
    for (const [overrides, preferences, expected] of [
      [{}, undefined, false],
      [{ AI: {} }, [], false],
      [{ AI: {}, [`IFUND_${agent.name.toUpperCase()}_AI_ENABLED`]: "disabled" }, undefined, false],
      [{ AI: { run() {} } }, undefined, true],
    ]) {
      const backend = service({ preferences });
      const response = await agent.route(http(agent.name, "workspace"), { ...env, ...overrides }, backend.fetcher);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ai_available, expected);
    }
  }
});

test("malformed successful upstream JSON never becomes a successful workspace", async () => {
  for (const agent of agents) for (const malformed of ["/auth/v1/user", "_workspace"]) {
    const backend = service({ malformed });
    const response = await agent.route(http(agent.name, "workspace"), env, backend.fetcher);
    assert.equal(response.status, 503);
  }
});

test("a malformed reservation cannot spend inference or claim an artifact", async () => {
  for (const agent of agents) {
    const backend = service({ claims: { state: "claimed", lease: "invalid" } });
    const response = await agent.route(http(agent.name, agent.action, input(agent.name)), {
      ...env, AI: { run: () => assert.fail("unverified reservation") },
    }, backend.fetcher);
    assert.equal(response.status, 503);
    assert.ok(!backend.calls.some(call => call.url.endsWith("_finish")));
  }
});

test("private team/document context uses the verified owner token, source labels and credential redaction", async () => {
  const calls = [];
  const privateEnv = { ...env, IFUND_TEAM_CONTEXT_ENABLED: "enabled", IFUND_CAMPAIGN_DOCUMENTS_ENABLED: "enabled", IFUND_WORKFORCE_EXECUTOR_KEY: "a".repeat(64) };
  const fetcher = async (url, options) => {
    calls.push({ url, options, args: JSON.parse(options.body) });
    assert.equal(options.headers.Authorization, "Bearer verified.owner");
    if (url.endsWith("ifund_team_record_user") || url.endsWith("ifund_team_record_agent")) return Response.json(lease);
    if (url.endsWith("ifund_team_recent")) return Response.json([{
      id: lease, event_key: lease, agent_id: "orbit", speaker: "user", source_kind: "user_statement",
      content: "Budget estimate. PAYPAL_CLIENT_SECRET=private-example-secret", campaign_id: campaign, recorded_at: "2026-11-01T00:00:00Z",
    }]);
    if (url.endsWith("ifund_campaign_agent_document_briefs")) return Response.json([{
      document_id: lease, file_name: "budget.pdf", purpose: "budget", summary: "Owner-supplied budget estimate, not a receipt",
      owner_excerpt: "Planned cost $500", extracted_excerpt: "", owner_supplied: true, source_type: "uploaded_private_document_summary",
    }]);
    throw Error("Unexpected context endpoint");
  };
  const api = { jwt: "verified.owner" };
  const references = await specialistReferences({ api, env: privateEnv, fetcher, agent: "strategy", requestId,
    content: "Help with my budget", campaignIds: [campaign] });
  const messages = withSpecialistReferences([{ role: "system", content: "Draft a plan." }, { role: "user", content: "API_KEY=another-private-example-secret" }], references);
  assert.ok(!JSON.stringify(messages).includes("private-example-secret"));
  assert.equal(references.campaign_reference_documents[0].owner_supplied, true);
  assert.equal(references.shared_agent_history[0].agent_id, "orbit");
  assert.ok(calls.every(call => !Object.hasOwn(call.args, "owner_id")));
  assert.equal(calls.find(call => call.url.endsWith("ifund_team_record_user")).args.p_agent_id, "polaris");
  await recordSpecialistReply({ api, env: privateEnv, fetcher, agent: "strategy", requestId,
    campaignIds: [campaign], receipt: { summary: "Actual saved report" } });
  assert.equal(calls.at(-1).args.p_agent_id, "polaris");
  assert.notEqual(calls.at(-1).args.p_event_key, requestId);
  assert.equal(calls.at(-1).args.p_content, JSON.stringify({ summary: "Actual saved report" }));
});

test("enabled private references fail closed on revoked document access or absent trusted team proof", async () => {
  await assert.rejects(specialistReferences({ api: { jwt: "verified.owner" },
    env: { ...env, IFUND_CAMPAIGN_DOCUMENTS_ENABLED: "enabled" },
    fetcher: async () => new Response("Denied", { status: 403 }),
    agent: "communications", requestId, content: "Help", campaignIds: [campaign] }));
  await assert.rejects(specialistReferences({ api: { jwt: "verified.owner" },
    env: { ...env, IFUND_TEAM_CONTEXT_ENABLED: "enabled" },
    fetcher: () => assert.fail("untrusted team write"),
    agent: "growth", requestId, content: "Help", campaignIds: [campaign] }));
});

test("reference context cannot silently exceed the inference byte budget", () => {
  assert.throws(() => withSpecialistReferences([{ role: "system", content: "Instructions" }],
    { shared_agent_history: [{ content: "x".repeat(25000) }] }), /fewer campaigns/);
});
