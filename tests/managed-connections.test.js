import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  handleManagedConnections,
  permissionInput,
  selectedConnectionInput,
} from "../worker/agents/managedConnections.js";
import { CONNECTION_POLICY_VERSION } from "../worker/connections/catalog.js";
const uid = "11111111-1111-4111-8111-111111111111",
  revision = "22222222-2222-4222-8222-222222222222";
const env = {
  IFUND_CONNECTIONS_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
};
const grant = {
  operation_id: uid,
  provider: "discord",
  campaign_id: null,
  policy_version: CONNECTION_POLICY_VERSION,
  confirmed: true,
};
const http = (path = "workspace", body, authorization = "Bearer test.token") =>
  new Request("https://worker.test/api/agents/connections/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
function provider(overrides = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
      return Response.json(
        url.endsWith("/auth/v1/user")
          ? { id: uid, email_confirmed_at: "2026-01-01" }
          : overrides.response || {
              managed_available: true,
              connections: [],
              permissions: [],
              requests: [],
            },
        { status: overrides.status || 200 },
      );
    },
  };
}
test("help permission is exact/versioned/explicit and never accepts caller authority or secrets", () => {
  assert.equal(permissionInput(grant).p_confirmed, true);
  for (const extra of [
    { confirmed: false },
    { confirmed: "true" },
    { policy_version: "old" },
    { owner_id: uid },
    { subject: "platform_owner" },
    { access_token: "secret" },
    { provider: "invented" },
  ])
    assert.throws(() => permissionInput({ ...grant, ...extra }));
});
test("selected bulk changes are bounded unique versioned IDs and cannot accept approval or arbitrary cancellation scope", () => {
  const raw = {
    operation_id: uid,
    kind: "revoke",
    items: [{ id: uid, revision }],
  };
  assert.equal(selectedConnectionInput(raw).p_items.length, 1);
  for (const patch of [
    { items: [] },
    { items: [...raw.items, ...raw.items] },
    { items: [{ id: uid, revision: "stale" }] },
    { items: [{ id: uid, revision, owner_id: uid }] },
    {
      items: Array.from({ length: 51 }, () => ({
        id: crypto.randomUUID(),
        revision,
      })),
    },
    { kind: "approve_all" },
    { owner_id: uid },
  ])
    assert.throws(() => selectedConnectionInput({ ...raw, ...patch }));
});
test("unauthenticated and disabled runtime cannot reach Supabase", async () => {
  let calls = 0;
  const f = async () => {
    calls++;
    throw Error("unexpected");
  };
  assert.equal(
    (await handleManagedConnections(http("workspace", undefined, ""), env, f))
      .status,
    401,
  );
  assert.equal(
    (
      await handleManagedConnections(
        http(),
        { ...env, IFUND_CONNECTIONS_ENABLED: "disabled" },
        f,
      )
    ).status,
    503,
  );
  assert.equal(calls, 0);
  const r = await worker.fetch(
    new Request("https://worker.test/health"),
    env,
    {},
  );
  assert.deepEqual(await r.json(), {
    service: "ifund-managed-connections-agent",
    enabled: true,
    provider_execution: false,
    financial_authority: false,
  });
});
test("workspace checks fresh auth then authoritative backend and returns all43 catalog identities without access claims", async () => {
  const p = provider();
  const r = await handleManagedConnections(http(), env, p.fetch),
    w = await r.json();
  assert.equal(r.status, 200);
  assert.equal(w.providers.length, 43);
  assert.equal(p.calls.length, 2);
  assert.ok(p.calls[0].url.endsWith("/auth/v1/user"));
  assert.ok(p.calls[1].url.endsWith("/rpc/ifund_connections_workspace"));
  assert.ok(
    w.providers.every(
      (x) => !("access_token" in x) && !("legacy_auth_hint" in x),
    ),
  );
});
test("discovery never treats source OAuth hints as verified IFund registration", async () => {
  const p = provider();
  const r = await handleManagedConnections(
      http("methods?provider=discord"),
      env,
      p.fetch,
    ),
    m = await r.json();
  assert.equal(m.status, "setup_required");
  assert.equal(m.financial_authority, false);
  assert.equal(m.account_creation_verified, false);
  assert.deepEqual(m.capabilities, []);
  assert.match(m.message, /IFund is still setting up/);
});
test("owner actions map only accepted fields into UID-derived backend contracts", async () => {
  const p = provider({ response: { permission: { id: revision } } });
  let r = await handleManagedConnections(
    http("grant-help", grant),
    env,
    p.fetch,
  );
  assert.equal(r.status, 200);
  assert.deepEqual(p.calls[1].body, permissionInput(grant));
  const q = provider({
    response: { request: { id: revision, state: "setup_required" } },
  });
  r = await handleManagedConnections(
    http("requests", {
      operation_id: uid,
      provider: "discord",
      action: "connect",
    }),
    env,
    q.fetch,
  );
  assert.equal(r.status, 200);
  assert.equal(q.calls[1].body.p_provider, "discord");
  assert.equal(q.calls[1].body.p_campaign_id, null);
  assert.ok(!("p_owner_id" in q.calls[1].body));
});
test("invalid or oversized commands never reach an action RPC and backend denial is preserved", async () => {
  const p = provider();
  assert.equal(
    (
      await handleManagedConnections(
        http("requests", {
          operation_id: uid,
          provider: "discord",
          action: "repair",
        }),
        env,
        p.fetch,
      )
    ).status,
    400,
  );
  assert.equal(p.calls.length, 1);
  const big = provider();
  assert.equal(
    (
      await handleManagedConnections(
        http("grant-help", { ...grant, secret: "x".repeat(17000) }),
        env,
        big.fetch,
      )
    ).status,
    413,
  );
  assert.equal(big.calls.length, 1);
  const denied = async (url) =>
    url.endsWith("/auth/v1/user")
      ? Response.json({ id: uid, email_confirmed_at: "yes" })
      : Response.json({ code: "42501" }, { status: 403 });
  assert.equal(
    (await handleManagedConnections(http(), env, denied)).status,
    403,
  );
});
test("worker rejects foreign routes/methods and never leaks upstream errors or raw provider state", async () => {
  const p = provider();
  assert.equal(
    (
      await handleManagedConnections(
        http("execute-provider", { owner_id: uid }),
        env,
        p.fetch,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handleManagedConnections(
        http("workspace", { arbitrary: true }),
        env,
        p.fetch,
      )
    ).status,
    405,
  );
  assert.equal(p.calls.length, 0);
  const response = await handleManagedConnections(http(), env, async () => {
    throw Error("SECRET-CREDENTIAL");
  });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("SECRET-CREDENTIAL"));
});
