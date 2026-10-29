import test from "node:test";
import assert from "node:assert/strict";
import {
  workerCommunityApiEnabled,
  createCommunityPost,
  deleteCommunityPost,
} from "../src/lib/communityApi.js";

const id = "b7486a53-40a8-4a71-8377-141332ab4341";
const db = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: "user.session.jwt" } },
      error: null,
    }),
  },
};

test("community Worker mode is disabled until explicitly enabled", () => {
  assert.equal(workerCommunityApiEnabled, false);
});

test("create community post uses signed-in bearer and strips surrounding whitespace", async () => {
  const seen = [];
  const result = await createCommunityPost(db, " Hello! ", async (url, options) => {
    seen.push({ url, options });
    return Response.json(
      { id, body: "Hello!", created_at: "2026-10-25T00:00:00Z" },
      { status: 201 },
    );
  });
  assert.equal(result.id, id);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "/api/community/posts");
  assert.equal(seen[0].options.method, "POST");
  assert.equal(seen[0].options.credentials, "same-origin");
  assert.equal(seen[0].options.headers.Authorization, "Bearer user.session.jwt");
  assert.deepEqual(JSON.parse(seen[0].options.body), { body: "Hello!" });
});

test("post validation and no-login block before any network request", async () => {
  const fetcher = () => {
    throw new Error("network should not run");
  };
  for (const message of ["", "    ", "x".repeat(2001), null]) {
    await assert.rejects(createCommunityPost(db, message, fetcher), /1.2000/);
  }
  await assert.rejects(
    createCommunityPost(
      { auth: { getSession: async () => ({ data: { session: null } }) } },
      "Hello",
      fetcher,
    ),
    /sign in again/i,
  );
});

test("post submission does not falsely report success without matching content", async () => {
  await assert.rejects(
    createCommunityPost(db, "Hello", async () => Response.json({ id, body: "Other" })),
    /verified/,
  );
  await assert.rejects(
    createCommunityPost(db, "Hello", async () =>
      Response.json({ error: "Service unavailable" }, { status: 503 }),
    ),
    /Service unavailable/,
  );
});

test("delete post uses exact ID, bearer JWT and verifies deletion result", async () => {
  const calls = [];
  const result = await deleteCommunityPost(db, id, async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id, deleted: true });
  });
  assert.deepEqual(result, { id, deleted: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/community/posts/" + id);
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[0].options.headers.Authorization, "Bearer user.session.jwt");
});

test("unauthorized, invalid and unverified deletions never report success", async () => {
  const noNetwork = () => {
    throw new Error("network should not run");
  };
  await assert.rejects(deleteCommunityPost(db, "bad", noNetwork), /Invalid post ID/);
  await assert.rejects(
    deleteCommunityPost(db, id, async () => Response.json({ id, deleted: false })),
    /verified/,
  );
  await assert.rejects(
    deleteCommunityPost(db, id, async () =>
      Response.json({ error: "Post not found." }, { status: 404 }),
    ),
    /Post not found/,
  );
});
