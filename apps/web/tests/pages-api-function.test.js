import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../../../functions/api/[[path]].js";

test("Pages API function delegates health checks to the independent Worker", async () => {
  const response = await onRequest({
    request: new Request("https://preview.example/api/health"),
    env: {},
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "ifund-migration-api",
    production: false,
  });
});

test("unknown API routes remain a 404 through the Pages function", async () => {
  const response = await onRequest({
    request: new Request("https://preview.example/api/not-implemented"),
    env: {},
  });
  assert.equal(response.status, 404);
});
