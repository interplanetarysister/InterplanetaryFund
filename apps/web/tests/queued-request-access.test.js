import test from "node:test";
import assert from "node:assert/strict";
import { loadWritingWorkspaceAccess } from "../src/lib/writingWorkspace.js";

const saved = {
  request_id: "owner-request",
  task: { details: "My private saved request" },
};
test("a disabled writing service does not hide owner text or its erasure controls", async () => {
  const result = await loadWritingWorkspaceAccess(async (path) => {
    if (path === "subscription") throw Error("Service disabled");
    assert.equal(path, "queued-requests");
    return { queued_requests: [saved] };
  });
  assert.equal(result.access, null);
  assert.deepEqual(result.queued_requests, [saved]);
});
test("expired service eligibility preserves owner queue discovery", async () => {
  const result = await loadWritingWorkspaceAccess(async (path) =>
    path === "subscription"
      ? { active: false, level: 0 }
      : { queued_requests: [saved] },
  );
  assert.equal(result.access.active, false);
  assert.deepEqual(result.queued_requests, [saved]);
});
test("a denied queue read never manufactures saved text or disables valid writing access", async () => {
  const result = await loadWritingWorkspaceAccess(async (path) => {
    if (path === "queued-requests") throw Error("Owner access denied");
    return { active: true, level: 1 };
  });
  assert.deepEqual(result.queued_requests, []);
  assert.equal(result.access.active, true);
});
