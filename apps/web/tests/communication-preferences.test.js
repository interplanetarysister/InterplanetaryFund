import test from "node:test";
import assert from "node:assert/strict";
import {
  loadCommunicationPreferences,
  saveCommunicationPreferences,
} from "../src/lib/communicationPreferences.js";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
function client(id = uid) {
  const calls = [];
  const c = {
    calls,
    row: { id, comm_prefs: { email_updates: true, in_app_updates: true } },
    auth: {
      getUser: async () => ({
        data: { user: { id, email_confirmed_at: "today" } },
      }),
    },
    from: () => c,
    select: () => c,
    eq: (k, v) => {
      calls.push([k, v]);
      return c;
    },
    update: (v) => {
      calls.push(["update", v]);
      c.next = v.comm_prefs;
      return c;
    },
    maybeSingle: async () => {
      if (c.row && c.next && !c.wrong) c.row = { ...c.row, comm_prefs: c.next };
      return { data: c.row };
    },
  };
  return c;
}
test("preferences load current confirmed owner and save only preference column with CAS", async () => {
  const c = client();
  const s = await loadCommunicationPreferences(c);
  await saveCommunicationPreferences(c, s, {
    email_updates: true,
    in_app_updates: false,
  });
  assert.ok(
    c.calls.some(
      ([k, v]) => k === "comm_prefs" && v === JSON.stringify(s.values),
    ),
  );
  assert.deepEqual(c.calls.find(([k]) => k === "update")[1], {
    comm_prefs: { email_updates: true, in_app_updates: false },
  });
});
test("account switching and stale rows cannot re-enable saved opt-outs", async () => {
  const c = client();
  const s = await loadCommunicationPreferences(c);
  await assert.rejects(
    saveCommunicationPreferences(client(other), s, s.values),
  );
  c.row = null;
  await assert.rejects(saveCommunicationPreferences(c, s, s.values));
});

test("a matching owner response with unchanged preferences is not a confirmed opt-out", async () => {
  const c = client();
  const s = await loadCommunicationPreferences(c);
  c.wrong = true;
  await assert.rejects(
    saveCommunicationPreferences(c, s, {
      email_updates: true,
      in_app_updates: false,
    }),
    /not confirmed/,
  );
});
