import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REPORTER_BLOG_ID,
  MAX_TITLE_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_BODY_LENGTH,
  validateStory,
  canManagePublication,
  loadReporterWorkspace,
  saveReporterStory,
} from "../src/lib/reporterWorkspace.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ENTRY = "33333333-3333-4333-8333-333333333333";
const confirmed = (id) => ({ id, email_confirmed_at: "2026-10-15T12:00:00Z" });

function fakeClient({ owner = true, active = true, saveError, mismatched = false } = {}) {
  const calls = [];
  return {
    calls,
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: { account_status: active ? "active" : "suspended", account_deletion_pending: false } };
        },
      };
    },
    async rpc(name, input) {
      calls.push({ name, input });
      if (name === "ifund_my_blog_workspace")
        return { data: { blogs: owner ? [{ id: REPORTER_BLOG_ID, entries: [{ id: ENTRY }] }] : [], can_create: false } };
      if (saveError || !owner) return { error: { code: saveError || "42501" } };
      return { data: { id: input.p_entry_id || ENTRY, blog_id: mismatched ? OTHER : input.p_blog_id, status: input.p_status } };
    },
  };
}

test("the blog id is the legacy text reference, not a uuid", () => {
  assert.equal(REPORTER_BLOG_ID, "6ac9c315a7434f25c88834b5");
  assert.doesNotMatch(REPORTER_BLOG_ID, /^[0-9a-f-]{36}$/);
});

test("story validation enforces required fields and length limits", () => {
  assert.equal(
    validateStory({ title: "T", summary: "", body: "B", status: "draft" }).ok,
    true,
  );
  // Publishing requires a summary.
  assert.equal(
    validateStory({ title: "T", summary: "", body: "B", status: "published" })
      .ok,
    false,
  );
  assert.equal(
    validateStory({ title: "T", summary: "S", body: "B", status: "published" })
      .ok,
    true,
  );

  for (const bad of ["", "   ", null, undefined]) {
    assert.equal(
      validateStory({ title: bad, summary: "", body: "B" }).ok,
      false,
      `title ${String(bad)}`,
    );
  }
  assert.equal(
    validateStory({ title: "T", summary: "", body: "  " }).ok,
    false,
    "empty body",
  );
  assert.equal(
    validateStory({
      title: "x".repeat(MAX_TITLE_LENGTH + 1),
      summary: "",
      body: "B",
    }).ok,
    false,
  );
  assert.equal(
    validateStory({
      title: "T",
      summary: "x".repeat(MAX_SUMMARY_LENGTH + 1),
      body: "B",
    }).ok,
    false,
  );
  assert.equal(
    validateStory({
      title: "T",
      summary: "",
      body: "x".repeat(MAX_BODY_LENGTH + 1),
    }).ok,
    false,
  );
  // An unknown status is refused rather than passed through.
  assert.equal(
    validateStory({ title: "T", summary: "S", body: "B", status: "archived" })
      .ok,
    false,
  );
});

test("validation trims before measuring", () => {
  const result = validateStory({
    title: "  Spaced  ",
    summary: "  s  ",
    body: "  b  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.title, "Spaced");
  assert.equal(result.value.summary, "s");
  assert.equal(result.value.body, "  b  ", "body is preserved, not trimmed");
});

test("only a confirmed email on an active account may publish", async () => {
  const client = fakeClient();
  assert.equal((await canManagePublication(client, confirmed(OWNER))).ok, true);
  assert.equal(
    (await canManagePublication(client, { id: OWNER })).ok,
    false,
    "unconfirmed email",
  );
  assert.equal((await canManagePublication(client, null)).ok, false, "no user");
  assert.equal(
    (
      await canManagePublication(
        fakeClient({ active: false }),
        confirmed(OWNER),
      )
    ).ok,
    false,
    "suspended account",
  );
});

test("the workspace reads only blogs returned by the owner-scoped RPC", async () => {
  const member = confirmed(OWNER);
  assert.deepEqual(await loadReporterWorkspace(fakeClient({ owner: false }), member), { blogs: [], can_create: false });
  const client = fakeClient();
  assert.equal((await loadReporterWorkspace(client, member)).blogs[0].entries[0].id, ENTRY);
  assert.deepEqual(client.calls.map(call => call.name), ["ifund_my_blog_workspace"]);
});

test("saving and publishing delegate ownership, classification and timestamps to the server", async () => {
  const client = fakeClient();
  const member = confirmed(OWNER);
  const story = { title: "Story", summary: "Summary", body: "Body", blogId: OTHER };
  const draft = await saveReporterStory(client, member, story);
  const published = await saveReporterStory(client, member, { ...story, id: draft.id, status: "published" });
  assert.equal(published.status, "published");
  assert.deepEqual(client.calls.map(call => call.input), [
    { p_blog_id: OTHER, p_entry_id: null, p_title: "Story", p_summary: "Summary", p_body: "Body", p_status: "draft" },
    { p_blog_id: OTHER, p_entry_id: ENTRY, p_title: "Story", p_summary: "Summary", p_body: "Body", p_status: "published" },
  ]);
});

test("a malformed reference or suspended account does not reach the write RPC", async () => {
  const input = { title: "Story", summary: "Summary", body: "Body" };
  const invalid = fakeClient();
  await assert.rejects(saveReporterStory(invalid, confirmed(OWNER), { ...input, id: "../../file" }), /not valid/);
  assert.equal(invalid.calls.length, 0);
  const suspended = fakeClient({ active: false });
  await assert.rejects(saveReporterStory(suspended, confirmed(OWNER), input), /suspended|no longer|could not be verified/i);
  assert.equal(suspended.calls.length, 0);
});

test("access errors, write errors and mismatched responses cannot report success", async () => {
  const member = confirmed(OWNER);
  const input = { title: "Story", summary: "Summary", body: "Body" };
  await assert.rejects(saveReporterStory(fakeClient({ owner: false }), member, input), /publishing access/);
  await assert.rejects(saveReporterStory(fakeClient({ saveError: "XX000" }), member, input), /not saved/);
  await assert.rejects(saveReporterStory(fakeClient({ mismatched: true }), member, input), /not saved as expected/);
});

test("the publishing workspace is routed and member-gated", () => {
  // Collapse whitespace so a Prettier reflow cannot break these assertions.
  const flat = (path) =>
    readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(
      /\s+/g,
      " ",
    );
  const app = flat("src/App.jsx");
  // Both the new path and the root app's old /my-blog path reach the workspace.
  assert.match(
    app,
    /path="\/publication" element=\{<MemberAccess><MyPublication \/><\/MemberAccess>\}/,
    "/publication must exist and be member-gated",
  );
  assert.match(
    app,
    /path="\/my-blog" element=\{<MemberAccess><MyPublication \/><\/MemberAccess>\}/,
    "the root app's /my-blog must keep working",
  );
  // The page must go through the ownership-checked library, never a raw insert.
  const page = flat("src/pages/MyPublication.jsx");
  assert.match(
    page,
    /saveReporterStory\(authClient\(\)/,
    "writes must go through the checked library",
  );
  assert.doesNotMatch(
    page,
    /from\("ifund_blog_entries"\)\.insert|\.insert\(/,
    "no direct insert in the page",
  );
  assert.doesNotMatch(
    page,
    /from\("ifund_blogs"\)/,
    "no direct blog write in the page",
  );
});
