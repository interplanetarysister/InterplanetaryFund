import test from "node:test";
import assert from "node:assert/strict";
import {
  saveCampaignThroughWorker,
  workerCampaignApiEnabled,
} from "../src/lib/campaignApi.js";

const campaignId = "b7486a53-40a8-4a71-8377-141332ab4341";
const db = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: "test.signed.jwt" } },
      error: null,
    }),
  },
};

test("Worker campaign transport is disabled by default", () => {
  assert.equal(workerCampaignApiEnabled, false);
});

test("Worker draft creation sends the verified session bearer, never a service key", async () => {
  const calls = [];
  const id = await saveCampaignThroughWorker(
    db,
    { title: "Cleanup", status: "draft" },
    null,
    async (url, options) => {
      calls.push({ url, options });
      return Response.json({ id: campaignId, status: "draft" }, { status: 201 });
    },
  );
  assert.equal(id, campaignId);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/campaigns");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test.signed.jwt");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(JSON.parse(calls[0].options.body).status, "draft");
});

test("editing a campaign uses PATCH on only the requested campaign", async () => {
  const urls = [];
  await saveCampaignThroughWorker(
    db,
    { title: "Edited", status: "draft" },
    campaignId,
    async (url, options) => {
      urls.push({ url, method: options.method });
      return Response.json({ id: campaignId });
    },
  );
  assert.deepEqual(urls, [
    { url: "/api/campaigns/" + campaignId, method: "PATCH" },
  ]);
});

test("missing signed-in session never sends a network request", async () => {
  const noSession = { auth: { getSession: async () => ({ data: { session: null } }) } };
  await assert.rejects(
    saveCampaignThroughWorker(noSession, { title: "Draft" }, null, () => {
      throw Error("network must not run");
    }),
    /sign in again/i,
  );
});

test("Worker failures do not report a successful save", async () => {
  await assert.rejects(
    saveCampaignThroughWorker(db, { title: "Draft" }, null, async () =>
      Response.json({ error: "Campaign save unavailable." }, { status: 503 }),
    ),
    /unavailable/,
  );
  await assert.rejects(
    saveCampaignThroughWorker(db, { title: "Draft" }, null, async () =>
      Response.json({ status: "draft" }),
    ),
    /could not be verified/i,
  );
});
