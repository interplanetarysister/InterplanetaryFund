import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProfileInput } from "../src/lib/profileInput.js";
test("normalizes only editable fields and never forwards privileges", () => {
  assert.deepEqual(normalizeProfileInput({ display_name: "  Jane  ", handle: " jane_1 ", role: "super_admin", owner_id: "other" }),
    { display_name: "Jane", handle: "jane_1" });
  assert.deepEqual(normalizeProfileInput({ display_name: "  ", handle: "" }), { display_name: null, handle: null });
});
test("rejects invalid handles and overly long display names", () => {
  for (const handle of ["ab", "a b", "admin@host", "a".repeat(33)]) {
    assert.throws(() => normalizeProfileInput({ handle }), /Handles must/);
  }
  assert.throws(() => normalizeProfileInput({ display_name: "x".repeat(101) }), /Display name/);
});
