import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePostBody, canMemberPost, publishPost, MAX_POST_LENGTH } from "../src/lib/socialPosts.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST_ID = "33333333-3333-4333-8333-333333333333";
const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

function fakeClient({
  accountStatus = "active", deletionPending = false, insertError = false, returnOtherAuthor = false,
} = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push({ type: "table", table });
      const q = { filters: [] };
      const api = {
        select(columns) { calls.push({ type: "select", table, columns }); return api; },
        insert(payload) { calls.push({ type: "insert", table, payload }); q.payload = payload; return api; },
        eq(column, value) { q.filters.push([column, value]); calls.push({ type: "eq", table, column, value }); return api; },
        order() { return api; },
        limit() { return api; },
        maybeSingle() { return Promise.resolve(resolve(table, q, "maybe")); },
        single() { return Promise.resolve(resolve(table, q, "single")); },
        then(f, r) { return Promise.resolve(resolve(table, q, "list")).then(f, r); },
      };
      return api;
    },
  };
  function resolve(table, q, mode) {
    if (table === "ifund_profiles") {
      return { data: { account_status: accountStatus, account_deletion_pending: deletionPending }, error: null };
    }
    if (table === "ifund_posts") {
      if (insertError) return { data: null, error: { message: "insert failed" } };
      const author = returnOtherAuthor ? OTHER : q.payload.author_id;
      return { data: { id: POST_ID, author_id: author, body: q.payload.body, created_at: "2026-11-02T00:00:00Z" }, error: null };
    }
    return { data: null, error: { message: "unexpected table" } };
  }
}
const user = (over = {}) => ({ id: OWNER, email_confirmed_at: "2026-10-15T12:00:00Z", ...over });

test("post bodies are trimmed and bounded like the Worker rule", () => {
  assert.equal(validatePostBody("  hello  "), "hello");
  assert.equal(validatePostBody("x".repeat(MAX_POST_LENGTH)).length, MAX_POST_LENGTH);
  for (const bad of ["", "   ", "\n\t", "x".repeat(MAX_POST_LENGTH + 1), null, 12, undefined, {}]) {
    assert.equal(validatePostBody(bad), null, `rejects ${JSON.stringify(bad)}`);
  }
});

test("only a confirmed email on a live account may post", async () => {
  assert.equal((await canMemberPost(fakeClient(), user())).ok, true);
  // Unconfirmed email.
  assert.equal((await canMemberPost(fakeClient(), user({ email_confirmed_at: null }))).ok, false);
  assert.equal((await canMemberPost(fakeClient(), null)).ok, false);
  // Suspended account.
  const suspended = await canMemberPost(fakeClient({ accountStatus: "suspended" }), user());
  assert.equal(suspended.ok, false);
  assert.match(suspended.message, /no longer available/i);
  // Scheduled for deletion.
  const deleting = await canMemberPost(fakeClient({ deletionPending: true }), user());
  assert.equal(deleting.ok, false);
  assert.match(deleting.message, /scheduled for deletion/i);
});

test("a suspended account cannot post and no database write is attempted", async () => {
  const f = fakeClient({ accountStatus: "suspended" });
  await assert.rejects(publishPost(f, user(), "hello"), /no longer available/i);
  assert.equal(f.calls.some((c) => c.type === "insert"), false, "no insert may be attempted");
});

test("an unconfirmed email cannot post and no database write is attempted", async () => {
  const f = fakeClient();
  await assert.rejects(publishPost(f, user({ email_confirmed_at: null }), "hello"), /Confirm your email/i);
  assert.equal(f.calls.some((c) => c.type === "insert"), false);
});

test("an invalid body never reaches the database", async () => {
  const f = fakeClient();
  await assert.rejects(publishPost(f, user(), "   "), /1–2000 characters/);
  assert.equal(f.calls.some((c) => c.type === "insert"), false);
});

test("a published post sends only author_id and body", async () => {
  const f = fakeClient();
  const row = await publishPost(f, user(), "  Hello friends  ");
  assert.equal(row.id, POST_ID);
  const insert = f.calls.find((c) => c.type === "insert");
  assert.deepEqual(insert.payload, { author_id: OWNER, body: "Hello friends" });
});

test("a post that returns another author, or fails, is not reported as published", async () => {
  await assert.rejects(publishPost(fakeClient({ returnOtherAuthor: true }), user(), "hi"), /not published/);
  await assert.rejects(publishPost(fakeClient({ insertError: true }), user(), "hi"), /not published/);
});

test("the feed page gates the composer and posts through the validated path", () => {
  const page = source("src/pages/SocialFeedPage.jsx");
  assert.match(page, /import \{ canMemberPost, publishPost, MAX_POST_LENGTH \} from "@\/lib\/socialPosts\.js"/);
  assert.match(page, /canMemberPost\(authClient\(\), data\.user\)/);
  assert.match(page, /await publishPost\(authClient\(\), user, body\)/);
  assert.match(page, /maxLength=\{MAX_POST_LENGTH\}/);
  // The raw insert must be gone.
  assert.doesNotMatch(page, /from\("ifund_posts"\)\.insert/);
});
