import test from "node:test";
import assert from "node:assert/strict";
import { resolveInitialUser } from "../src/lib/authBootstrap.js";

test("returns the current Supabase user when the initial lookup succeeds", async () => {
  const user = { id: "user-1" };
  assert.equal(await resolveInitialUser(async () => ({ data: { user }, error: null })), user);
});

test("returns signed-out state when there is no current user", async () => {
  assert.equal(await resolveInitialUser(async () => ({ data: { user: null }, error: null })), null);
});

test("fails closed when Supabase returns an auth error", async () => {
  assert.equal(await resolveInitialUser(async () => ({ data: { user: null }, error: new Error("offline") })), null);
});

test("fails closed when the initial auth request rejects", async () => {
  assert.equal(await resolveInitialUser(async () => { throw new Error("network unavailable"); }), null);
});
