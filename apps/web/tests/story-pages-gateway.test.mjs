import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/agents/story/[[path]].js";

const storyRequest = () => new Request(
  "https://preview.example/api/agents/story/drafts?source=test",
  {
    method: "POST",
    headers: {
      authorization: "Bearer member-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ campaign_id: "11111111-1111-4111-8111-111111111111" }),
  },
);

test("Story Pages gateway fails closed without a server-side service binding", async () => {
  const response = await onRequest({ request: storyRequest(), env: {} });

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match((await response.json()).error, /not available yet/i);
});

test("Story Pages gateway forwards the original request unchanged to the bound worker", async () => {
  const calls = [];
  const env = {
    IFUND_STORY_AGENT: {
      fetch: async (request) => {
        calls.push({
          url: request.url,
          method: request.method,
          authorization: request.headers.get("authorization"),
          contentType: request.headers.get("content-type"),
          body: await request.text(),
        });
        return Response.json({ received: true }, { status: 201 });
      },
    },
  };

  const response = await onRequest({ request: storyRequest(), env });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { received: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://preview.example/api/agents/story/drafts?source=test");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].authorization, "Bearer member-token");
  assert.equal(calls[0].contentType, "application/json");
  assert.deepEqual(JSON.parse(calls[0].body), {
    campaign_id: "11111111-1111-4111-8111-111111111111",
  });
});
