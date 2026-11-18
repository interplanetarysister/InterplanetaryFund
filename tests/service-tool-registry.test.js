import test from "node:test";
import assert from "node:assert/strict";
import {
  createToolRegistry,
  toolInputHash,
} from "../worker/services/tool-registry.js";
import { serviceSkill } from "../worker/services/skills/index.js";
const uid = "11111111-1111-4111-8111-111111111111";
const schema = { type: "object", properties: {}, additionalProperties: false };
const binding = (extra = {}) => ({
  name: "getAgentAccountContext",
  effect: "read",
  roles: ["story_agent"],
  available: true,
  tested_revision: "tested-v1",
  implementation_revision: "tested-v1",
  cost_status: "verified_free",
  valid_until: new Date(Date.now() + 60000).toISOString(),
  input_schema: schema,
  validateInput: (x) => x,
  invoke: async () => ({ safe: true }),
  redact: (r) => r,
  ...extra,
});
const scope = (role) => ({ allowed: true, owner_id: uid, role, plan_level: 1 });
test("source manifests preserve all role declarations without granting unresolved skills or extra tools", () => {
  const skill = serviceSkill("managed_connection_agent");
  assert.equal(skill.min_plan_level, 2);
  assert.equal(skill.remote_content_reconciled, false);
  assert.ok(
    skill.declared_functions.includes("requestManagedConnectionAction"),
  );
  assert.throws(() =>
    createToolRegistry({
      bindings: [binding({ name: "executeIntegrationChange" })],
      authorize: async () => scope("story_agent"),
    }),
  );
  assert.throws(() =>
    createToolRegistry({
      bindings: [binding({ name: "manageAdminBuilderWork" })],
      authorize: async () => scope("story_agent"),
    }),
  );
});
test("unavailable, untested, paid and expired adapters never reach a provider", async () => {
  for (const patch of [
    { available: false },
    { tested_revision: "old" },
    { cost_status: "paid" },
    { valid_until: "2020-01-01" },
  ]) {
    let invoked = 0;
    const r = createToolRegistry({
      bindings: [
        binding({
          ...patch,
          invoke: async () => {
            invoked++;
          },
        }),
      ],
      authorize: async () => scope("story_agent"),
    });
    assert.deepEqual(r.definitions("story_agent", scope("story_agent")), []);
    await assert.rejects(
      r.invoke("story_agent", "getAgentAccountContext", {}, {}),
    );
    assert.equal(invoked, 0);
  }
});
test("every invocation gets fresh backend ownership and eligibility; payload cannot supply authority", async () => {
  let checks = 0,
    ran = 0;
  const r = createToolRegistry({
    bindings: [
      binding({
        invoke: async ({ scope: s }) => {
          ran++;
          assert.equal(s.owner_id, uid);
          return { safe: true };
        },
      }),
    ],
    authorize: async () => {
      checks++;
      return scope("story_agent");
    },
  });
  assert.deepEqual(
    await r.invoke("story_agent", "getAgentAccountContext", {}, {}),
    { safe: true },
  );
  assert.equal(checks, 1);
  assert.equal(ran, 1);
  await assert.rejects(
    r.invoke("story_agent", "getAgentAccountContext", { owner_id: uid }, {}),
  );
  assert.equal(ran, 1);
  const denied = createToolRegistry({
    bindings: [binding()],
    authorize: async () => ({ ...scope("story_agent"), allowed: false }),
  });
  await assert.rejects(
    denied.invoke("story_agent", "getAgentAccountContext", {}, {}),
  );
});
test("verification expiry during authorization and model-style success flags cannot establish a receipt", async () => {
  let time = Date.now(),
    runs = 0;
  const r = createToolRegistry({
    bindings: [
      binding({
        valid_until: new Date(time + 1000).toISOString(),
        invoke: async () => {
          runs++;
        },
      }),
    ],
    clock: () => time,
    authorize: async () => {
      time += 2000;
      return scope("story_agent");
    },
  });
  await assert.rejects(
    r.invoke("story_agent", "getAgentAccountContext", {}, {}),
  );
  assert.equal(runs, 0);
  const action = createToolRegistry({
    bindings: [
      binding({
        effect: "write",
        verifyReceipt: async () => false,
        invoke: async () => ({ receipt_verified: true, published: true }),
      }),
    ],
    authorize: async () => scope("story_agent"),
  });
  await assert.rejects(
    action.invoke("story_agent", "getAgentAccountContext", {}, {}),
    /not been confirmed/,
  );
});
test("private builder tools require a current verified administrator independently of requested role", async () => {
  const r = createToolRegistry({
    bindings: [
      binding({
        name: "manageAdminBuilderWork",
        effect: "write",
        verifyReceipt: async () => true,
        roles: ["admin_builder_agent"],
      }),
    ],
    authorize: async () => ({
      ...scope("admin_builder_agent"),
      verified_admin: false,
    }),
  });
  await assert.rejects(
    r.invoke("admin_builder_agent", "manageAdminBuilderWork", {}, {}),
  );
});
test("admin-only Stripe diagnostics remain hidden and denied for ordinary Outreach", async () => {
  let calls = 0;
  const r = createToolRegistry({
    bindings: [
      binding({
        name: "getStripeIntegrationAudit",
        roles: ["outreach_agent"],
        invoke: async () => {
          calls++;
          return {};
        },
      }),
    ],
    authorize: async () => scope("outreach_agent"),
  });
  assert.deepEqual(
    r.definitions("outreach_agent", scope("outreach_agent")),
    [],
  );
  await assert.rejects(
    r.invoke("outreach_agent", "getStripeIntegrationAudit", {}, {}),
    /administrator/,
  );
  assert.equal(calls, 0);
});
test("write-capable tools cannot omit effect classification or receipt verification", () => {
  for (const patch of [
    { effect: undefined },
    { effect: "read" },
    { effect: "write" },
  ])
    assert.throws(() =>
      createToolRegistry({
        bindings: [
          binding({
            name: "sendCommunication",
            roles: ["communications_agent"],
            ...patch,
          }),
        ],
        authorize: async () => scope("communications_agent"),
      }),
    );
});
test("exact current approval is checked before sending and trusted receipt verification follows it", async () => {
  let calls = 0;
  const input = {
      preview_id: "22222222-2222-4222-8222-222222222222",
      campaign_id: "44444444-4444-4444-8444-444444444444",
      approval_ref: "33333333-3333-4333-8333-333333333333",
    },
    hash = await toolInputHash(input);
  const b = binding({
    name: "sendCommunication",
    roles: ["communications_agent"],
    effect: "write",
    verifyReceipt: async () => true,
    invoke: async () => {
      calls++;
      return { sent: true };
    },
  });
  const missing = createToolRegistry({
    bindings: [b],
    authorize: async () => scope("communications_agent"),
  });
  await assert.rejects(
    missing.invoke("communications_agent", "sendCommunication", input, {}),
    /owner approval/,
  );
  assert.equal(calls, 0);
  const changed = createToolRegistry({
    bindings: [b],
    authorize: async () => ({
      ...scope("communications_agent"),
      owner_approval_verified: true,
      approval_tool: "sendCommunication",
      approved_input_hash: "different",
    }),
  });
  await assert.rejects(
    changed.invoke("communications_agent", "sendCommunication", input, {}),
  );
  assert.equal(calls, 0);
  const valid = createToolRegistry({
    bindings: [b],
    authorize: async () => ({
      ...scope("communications_agent"),
      owner_approval_verified: true,
      approval_tool: "sendCommunication",
      approved_input_hash: hash,
    }),
    verifyCampaignAssociation: async ({ campaign_id, owner_id }) =>
      campaign_id === "44444444-4444-4444-8444-444444444444" && owner_id === uid,
  });
  assert.deepEqual(
    await valid.invoke("communications_agent", "sendCommunication", input, {}),
    { sent: true },
  );
  assert.equal(calls, 1);
});
test("managed provider work needs current versioned help permission before an adapter runs", async () => {
  let calls = 0;
  const b = binding({
    name: "requestManagedConnectionAction",
    roles: ["managed_connection_agent"],
    effect: "write",
    verifyReceipt: async () => true,
    invoke: async () => {
      calls++;
      return { queued: true };
    },
  });
  const r = createToolRegistry({
    bindings: [b],
    authorize: async () => ({
      ...scope("managed_connection_agent"),
      plan_level: 2,
      obo_grant_verified: true,
      obo_permission_version: "old-version",
    }),
  });
  await assert.rejects(
    r.invoke(
      "managed_connection_agent",
      "requestManagedConnectionAction",
      {},
      {},
    ),
    /help permission/,
  );
  assert.equal(calls, 0);
});
test("approval hashes ignore only the top-level reference and bind all nested payload values", async () => {
  const a = {
      preview_id: "one",
      approval_ref: "reference-a",
      payload: { approval_ref: "meaningful-a" },
    },
    b = { ...a, approval_ref: "reference-b" },
    c = { ...a, payload: { approval_ref: "meaningful-b" } };
  assert.equal(await toolInputHash(a), await toolInputHash(b));
  assert.notEqual(await toolInputHash(a), await toolInputHash(c));
});

test("incident and builder approval or deployment remains a protected owner action", async () => {
  let calls = 0;
  const b = binding({
    name: "managePlatformIncidents",
    roles: ["admin_builder_agent"],
    effect: "write",
    verifyReceipt: async () => true,
    invoke: async () => {
      calls++;
      return { ok: true };
    },
  });
  const r = createToolRegistry({
    bindings: [b],
    authorize: async () => ({
      ...scope("admin_builder_agent"),
      verified_admin: true,
    }),
  });
  for (const mode of ["approve", "release", "deploy", "apply", "execute"])
    await assert.rejects(
      r.invoke("admin_builder_agent", "managePlatformIncidents", { mode }, {}),
      /protected owner review/,
    );
  assert.equal(calls, 0);
});


test("campaign support requires a backend-verified campaign owned by the acting IFund member", async () => {
  const campaignId = "44444444-4444-4444-8444-444444444444";
  let invoked = 0;
  const send = binding({
    name: "sendCommunication",
    roles: ["chief_of_staff"],
    effect: "write",
    verifyReceipt: async () => true,
    invoke: async () => { invoked++; return { sent: true }; },
  });
  const input = { campaign_id: campaignId, message: "A truthful campaign update" };
  const unverified = createToolRegistry({
    bindings: [send],
    authorize: async () => scope("chief_of_staff"),
  });
  await assert.rejects(
    unverified.invoke("chief_of_staff", "sendCommunication", input, {}),
    /verified IFund campaign/,
  );
  assert.equal(invoked, 0);

  const verified = createToolRegistry({
    bindings: [send],
    authorize: async () => scope("chief_of_staff"),
    verifyCampaignAssociation: async ({ campaign_id, owner_id }) =>
      campaign_id === campaignId && owner_id === uid,
  });
  assert.deepEqual(
    await verified.invoke("chief_of_staff", "sendCommunication", input, {}),
    { sent: true },
  );
  assert.equal(invoked, 1);
});

test("campaign delegation cannot run without an eligible IFund campaign; onboarding invitations remain allowed", async () => {
  const routed = binding({
    name: "routeAgentTask",
    roles: ["chief_of_staff"],
    effect: "write",
    verifyReceipt: async () => true,
    invoke: async ({ input }) => ({ dispatched: true, objective: input.objective }),
  });
  let verifiedCalls = 0;
  const registry = createToolRegistry({
    bindings: [routed],
    authorize: async () => scope("chief_of_staff"),
    verifyCampaignAssociation: async ({ campaign_id, owner_id }) => {
      verifiedCalls++;
      return campaign_id === "55555555-5555-4555-8555-555555555555" && owner_id === uid;
    },
  });
  await assert.rejects(
    registry.invoke("chief_of_staff", "routeAgentTask", {
      mode: "dispatch",
      objective: "Promote an unrelated external campaign and solicit donations",
      target_agent: "outreach_agent",
    }, {}),
    /verified IFund campaign/,
  );
  assert.equal(verifiedCalls, 0);

  const result = await registry.invoke("chief_of_staff", "routeAgentTask", {
    mode: "dispatch",
    objective: "Invite the external campaign owner to register and bring the campaign to IFund",
    target_agent: "outreach_agent",
  }, {});
  assert.equal(result.dispatched, true);
  assert.equal(verifiedCalls, 0);

  const growthResult = await registry.invoke("chief_of_staff", "routeAgentTask", {
    mode: "dispatch",
    objective: "Run platform marketing campaign to acquire new IFund users",
    target_agent: "growth_agent",
  }, {});
  assert.equal(growthResult.dispatched, true);
  assert.equal(verifiedCalls, 0);
});

test("general IFund growth and donor discovery for eligible campaigns do not restrict audience accounts", async () => {
  const growth = binding({
    name: "getAgentAccountContext",
    invoke: async () => ({ audience_research: true }),
  });
  let checks = 0;
  const registry = createToolRegistry({
    bindings: [growth],
    authorize: async () => scope("story_agent"),
    verifyCampaignAssociation: async () => { checks++; return false; },
  });
  assert.deepEqual(
    await registry.invoke("story_agent", "getAgentAccountContext", {
      audience: "non-IFund communities and prospective members",
      objective: "Discover potential supporters for Interplanetary Fund",
    }, {}),
    { audience_research: true },
  );
  assert.equal(checks, 0);
});

test("the shared runtime skill policy explicitly preserves external audience reach and blocks external campaign servicing", () => {
  for (const role of [
    "chief_of_staff",
    "growth_agent",
    "outreach_agent",
    "communications_agent",
    "story_agent",
    "strategy_agent",
    "finance_agent",
    "connection_discovery_agent",
    "managed_connection_agent",
  ]) {
    const instructions = serviceSkill(role).instructions;
    assert.match(instructions, /potential donors, supporters, partners, communities/);
    assert.match(instructions, /platform marketing, new-user acquisition/);
    assert.match(instructions, /do NOT manage, refine, write promotional fundraising copy for/);
    assert.match(instructions, /backend verification/);
  }
});


test("mixed onboarding and fundraising delegation cannot bypass campaign verification", async () => {
  const routed = binding({
    name: "routeAgentTask",
    roles: ["chief_of_staff"],
    effect: "write",
    verifyReceipt: async () => true,
    invoke: async () => ({ dispatched: true }),
  });
  const registry = createToolRegistry({
    bindings: [routed],
    authorize: async () => scope("chief_of_staff"),
  });
  for (const objective of [
    "Invite the external campaign owner to register and bring the campaign to IFund, then solicit donations for their external campaign",
    "Run IFund platform growth marketing and promote this unlinked external campaign",
  ]) {
    await assert.rejects(
      registry.invoke("chief_of_staff", "routeAgentTask", {
        mode: "dispatch", target_agent: "outreach_agent", objective,
      }, {}),
      /verified IFund campaign/,
    );
  }
});
