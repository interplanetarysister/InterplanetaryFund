import test from "node:test";
import assert from "node:assert/strict";
import { requestConnectionApi } from "../src/lib/connectionSession.js";

const session = (id, token = "token-" + id) => ({
  data: { session: { access_token: token, user: { id } } },
  error: null,
});

test("connection API sends only the authenticated member's bearer and bounded route", async () => {
  const calls = [];
  const client = { auth: { getSession: async () => session("member-a") } };
  const { result, ownerId } = await requestConnectionApi({
    client,
    path: "requests",
    body: { action: "connect" },
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ request: { status: "requested" } });
    },
  });
  assert.equal(ownerId, "member-a");
  assert.deepEqual(result, { request: { status: "requested" } });
  assert.equal(calls[0].url, "/api/agents/connections/requests");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer token-member-a");
  assert.equal(calls[0].options.body, JSON.stringify({ action: "connect" }));
});

test("connection API discards a response if the signed-in account changes mid-request", async () => {
  let reads = 0;
  const client = {
    auth: {
      getSession: async () => (++reads === 1 ? session("member-a") : session("member-b")),
    },
  };
  await assert.rejects(
    requestConnectionApi({
      client,
      path: "workspace",
      fetcher: async () =>
        Response.json({ connections: [{ private_for: "member-a" }] }),
    }),
    /account changed/,
  );
});

test("connection API rejects a session change before a follow-up request", async () => {
  const client = { auth: { getSession: async () => session("member-b") } };
  let called = false;
  await assert.rejects(
    requestConnectionApi({
      client,
      ownerId: "member-a",
      path: "workspace",
      fetcher: async () => {
        called = true;
        return Response.json({});
      },
    }),
    /account changed/,
  );
  assert.equal(called, false);
});

test("connection API does not send a request without a confirmed session", async () => {
  let called = false;
  await assert.rejects(
    requestConnectionApi({
      client: { auth: { getSession: async () => ({ data: {}, error: null }) } },
      path: "workspace",
      fetcher: async () => {
        called = true;
        return Response.json({});
      },
    }),
    /sign in/,
  );
  assert.equal(called, false);
});

test("connection API rejects unknown routes before network access", async () => {
  let called = false;
  await assert.rejects(
    requestConnectionApi({
      client: { auth: { getSession: async () => session("member-a") } },
      path: "admin",
      fetcher: async () => {
        called = true;
        return Response.json({});
      },
    }),
    /unavailable/,
  );
  assert.equal(called, false);
});
