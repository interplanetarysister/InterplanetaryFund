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

// A hand-written fake. It models the two behaviours that matter: which rows the
// caller can see, and whether an insert/upsert is accepted. It is not a mock of
// the logic under test — validateStory, the ownership re-check and the response
// verification all run for real.
function fakeClient({
  blogOwner = OWNER,
  entryOwner = OWNER,
  entries = [
    {
      id: ENTRY,
      blog_id: REPORTER_BLOG_ID,
      type: "article",
      title: "Existing",
      summary: "s",
      body: "b",
      status: "draft",
      published_at: null,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  ],
  accountActive = true,
  upsertFails = false,
  upsertReturnsOtherOwner = false,
  lookupFails = false,
} = {}) {
  const calls = [];
  const client = {
    calls,
    auth: {
      async getUser() {
        return { data: { user: confirmed(OWNER) }, error: null };
      },
    },
    from(table) {
      let upserting = false;
      let selecting = "";
      const api = {
        select(columns) {
          selecting = columns;
          calls.push({ type: "select", table, columns });
          return api;
        },
        eq() {
          return api;
        },
        order() {
          return api;
        },
        limit() {
          return Promise.resolve({
            data: table === "ifund_blog_entries" ? entries : null,
            error: null,
          });
        },
        upsert(row) {
          upserting = true;
          calls.push({ type: "upsert", table, row });
          return api;
        },
        maybeSingle() {
          if (table === "ifund_profiles")
            return Promise.resolve({
              data: accountActive
                ? { account_status: "active", account_deletion_pending: false }
                : {
                    account_status: "suspended",
                    account_deletion_pending: false,
                  },
              error: null,
            });
          if (table === "ifund_blogs") {
            if (lookupFails)
              return Promise.resolve({
                data: null,
                error: { message: "denied" },
              });
            return Promise.resolve({
              data: {
                id: REPORTER_BLOG_ID,
                title: "Reporter",
                description: "",
                owner_auth_user_id: blogOwner,
                legacy_owner_user_id: "legacy-1",
                status: "active",
              },
              error: null,
            });
          }
          if (table === "ifund_blog_entries") {
            if (upserting)
              return Promise.resolve({
                data: null,
                error: { message: "no single" },
              });
            // An entry lookup: only the owner can see their own row.
            if (entryOwner !== OWNER)
              return Promise.resolve({ data: null, error: null });
            return Promise.resolve({
              data: {
                id: ENTRY,
                published_at: null,
                created_at: "2026-11-01T00:00:00Z",
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        single() {
          if (upsertFails)
            return Promise.resolve({
              data: null,
              error: { message: "denied" },
            });
          const row =
            calls.filter((c) => c.type === "upsert").at(-1)?.row || {};
          return Promise.resolve({
            data: {
              id: row.id,
              title: row.title,
              status: row.status,
              published_at: row.published_at,
              updated_at: row.updated_at,
              owner_auth_user_id: upsertReturnsOtherOwner
                ? OTHER
                : row.owner_auth_user_id,
            },
            error: null,
          });
        },
        then(resolve) {
          // Awaiting a list query.
          return Promise.resolve({
            data: table === "ifund_blog_entries" ? entries : null,
            error: null,
          }).then(resolve);
        },
      };
      return api;
    },
  };
  return client;
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
        fakeClient({ accountActive: false }),
        confirmed(OWNER),
      )
    ).ok,
    false,
    "suspended account",
  );
});

test("a user who owns no blog gets an empty workspace, not an error", async () => {
  const client = fakeClient({ blogOwner: OTHER });
  const workspace = await loadReporterWorkspace(client, confirmed(OWNER));
  assert.deepEqual(workspace, { blog: null, entries: [] });
  // No entry read is attempted for a blog the user does not own.
  assert.equal(
    client.calls.filter(
      (c) => c.type === "select" && c.table === "ifund_blog_entries",
    ).length,
    0,
    "entries must not be queried when the user owns no blog",
  );
});

test("the owner gets their blog and their entries", async () => {
  const client = fakeClient();
  const workspace = await loadReporterWorkspace(client, confirmed(OWNER));
  assert.equal(workspace.blog.id, REPORTER_BLOG_ID);
  assert.equal(workspace.entries.length, 1);
  assert.equal(workspace.entries[0].title, "Existing");
});

test("saving a new story writes an owner-scoped draft", async () => {
  const client = fakeClient();
  const saved = await saveReporterStory(client, confirmed(OWNER), {
    title: "New",
    summary: "S",
    body: "B",
  });
  const write = client.calls.find((c) => c.type === "upsert");
  assert.ok(write, "an upsert must be issued");
  assert.equal(write.row.owner_auth_user_id, OWNER);
  assert.equal(write.row.blog_id, REPORTER_BLOG_ID);
  assert.equal(write.row.status, "draft");
  assert.equal(write.row.published_at, null, "a draft has no published_at");
  assert.equal(
    write.row.legacy_owner_user_id,
    "legacy-1",
    "legacy provenance is carried through",
  );
  assert.equal(saved.status, "draft");
});

test("publishing stamps published_at", async () => {
  const client = fakeClient();
  await saveReporterStory(client, confirmed(OWNER), {
    title: "Live",
    summary: "S",
    body: "B",
    status: "published",
  });
  const write = client.calls.find((c) => c.type === "upsert");
  assert.equal(write.row.status, "published");
  assert.ok(write.row.published_at, "published_at must be set on publish");
});

test("a non-owner cannot save, and no write is attempted", async () => {
  // The blog lookup is owner-scoped, so a non-owner sees no blog and the write
  // is refused before any upsert.
  const client = fakeClient({ blogOwner: OTHER });
  await assert.rejects(
    () =>
      saveReporterStory(client, confirmed(OWNER), {
        title: "T",
        summary: "S",
        body: "B",
      }),
    /does not own the publication/,
  );
  assert.equal(
    client.calls.filter((c) => c.type === "upsert").length,
    0,
    "no write may be attempted for a blog the user does not own",
  );
});

test("editing someone else's entry is refused", async () => {
  const client = fakeClient({ entryOwner: OTHER });
  await assert.rejects(
    () =>
      saveReporterStory(client, confirmed(OWNER), {
        id: ENTRY,
        title: "T",
        summary: "S",
        body: "B",
      }),
    /not yours to edit/,
  );
});

test("a forged or malformed story reference is refused", async () => {
  const client = fakeClient();
  for (const bad of [
    "../../etc/passwd",
    "x".repeat(200),
    "has space",
    "semi;colon",
  ]) {
    await assert.rejects(
      () =>
        saveReporterStory(client, confirmed(OWNER), {
          id: bad,
          title: "T",
          summary: "S",
          body: "B",
        }),
      /not valid|not yours to edit/,
      `ref ${bad}`,
    );
  }
});

test("a suspended account cannot save even if it owns the blog", async () => {
  const client = fakeClient({ accountActive: false });
  await assert.rejects(
    () =>
      saveReporterStory(client, confirmed(OWNER), {
        title: "T",
        summary: "S",
        body: "B",
      }),
    /suspended|no longer|could not be verified/i,
  );
  assert.equal(
    client.calls.filter((c) => c.type === "upsert").length,
    0,
    "no write on a suspended account",
  );
});

test("a rejected write surfaces an error rather than reporting success", async () => {
  const client = fakeClient({ upsertFails: true });
  await assert.rejects(
    () =>
      saveReporterStory(client, confirmed(OWNER), {
        title: "T",
        summary: "S",
        body: "B",
      }),
    /not saved/,
  );
});

test("a response that does not match the written row is treated as failure", async () => {
  // Guards against a permissive or misconfigured backend appearing to succeed.
  const client = fakeClient({ upsertReturnsOtherOwner: true });
  await assert.rejects(
    () =>
      saveReporterStory(client, confirmed(OWNER), {
        title: "T",
        summary: "S",
        body: "B",
      }),
    /not saved as expected/,
  );
});

test("a lookup failure is reported, not swallowed", async () => {
  const client = fakeClient({ lookupFails: true });
  await assert.rejects(
    () =>
      saveReporterStory(client, confirmed(OWNER), {
        title: "T",
        summary: "S",
        body: "B",
      }),
    /could not be verified/,
  );
});

test("official Reporter and member My Blog stay isolated until their server APIs are verified", () => {
  const flat = (path) =>
    readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(/\\s+/g, " ");
  const app = flat("src/App.jsx");
  assert.match(
    app,
    /path="\\/publication" element=\\{<MemberAccess><ComingSoon \/><\\/MemberAccess>\\}/,
    "official Reporter publishing stays unavailable until its owner API and RLS are verified",
  );
  assert.match(
    app,
    /path="\\/my-blog" element=\\{<MemberAccess><ComingSoon \/><\\/MemberAccess>\\}/,
    "member-owned My Blog must not be routed to the single official Reporter publication",
  );
  const page = flat("src/pages/MyPublication.jsx");
  assert.match(page, /official Reporter publication workspace/);
  assert.match(page, /not the member-owned \\/my-blog studio/);
});
