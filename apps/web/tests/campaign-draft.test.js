import test from "node:test";
import assert from "node:assert/strict";
import {
  makeDraftRequest,
  validateDraftSuggestion,
  requestCampaignDraft,
  requestCampaignSection,
} from "../src/api/campaignDraft.js";

const ID = "33333333-3333-4333-8333-333333333333";
const input = {
  details: "A community garden needs more tools.",
  beneficiary: "Neighbors",
  need: "Garden tools",
  cause: "community",
  goal: 600,
};
const suggestion = (assistance = "assisted") => ({
  titles: ["One", "Two", "Three", "Four", "Five"],
  summaries: ["First summary", "Second summary"],
  story: "A factual story.",
  image_prompt: "A symbolic garden illustration.",
  assistance,
  ai_inference: assistance === "assisted",
});
const client = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: "own.test.jwt" } },
    }),
  },
  functions: {
    invoke: () =>
      assert.fail("The canonical creator must use the same-origin service"),
  },
  from: () => assert.fail("Writing suggestions cannot write the campaign"),
};

test("draft requests retain the existing input bounds and factual answers", () => {
  assert.throws(() => makeDraftRequest({ details: "short" }), /12 characters/);
  const payload = makeDraftRequest(input);
  assert.equal(payload.answers.need, "Garden tools");
  assert.equal(payload.goal, 600);
  assert.throws(
    () => makeDraftRequest({ ...input, details: "x".repeat(2000) }),
    /was not shortened/,
  );
  assert.throws(
    () => makeDraftRequest({ ...input, beneficiary: "B".repeat(101) }),
    /was not shortened/,
  );
});
test("draft responses require all five titles, two summaries, story and honest assistance metadata", () => {
  assert.throws(
    () => validateDraftSuggestion({ titles: [], summaries: [] }),
    /incomplete/,
  );
  assert.throws(
    () => validateDraftSuggestion({ ...suggestion(), titles: ["One"] }),
    /incomplete/,
  );
  assert.throws(
    () => validateDraftSuggestion({ ...suggestion(), ai_inference: false }),
    /incomplete/,
  );
  assert.equal(
    validateDraftSuggestion(suggestion("outline")).assistance,
    "outline",
  );
  assert.equal(validateDraftSuggestion(suggestion()).story, "A factual story.");
});
test("no authenticated session means no service request", async () => {
  await assert.rejects(
    requestCampaignDraft(
      { auth: { getSession: async () => ({ data: {} }) } },
      input,
      { fetcher: () => assert.fail("No unauthenticated request") },
    ),
    /sign in/,
  );
});
test("campaign creation requests the permanent writing service without choosing a provider", async () => {
  let count = 0;
  const result = await requestCampaignDraft(client, input, {
    requestId: ID,
    fetcher: async (url, options) => {
      count++;
      assert.equal(url, "/api/services/story_agent/campaign-preview");
      assert.equal(options.headers.authorization, "Bearer own.test.jwt");
      const body = JSON.parse(options.body);
      assert.equal(body.request_id, ID);
      assert.equal(body.answers.beneficiary, "Neighbors");
      assert.equal(body.campaign_id, null);
      assert.equal(
        "model" in body || "provider" in body || "owner_id" in body,
        false,
      );
      return Response.json(suggestion());
    },
  });
  assert.equal(result.story, "A factual story.");
  assert.equal(count, 1);
});
test("queued writing is not reported as generated content and never automatically retries", async () => {
  let count = 0;
  await assert.rejects(
    requestCampaignDraft(client, input, {
      requestId: ID,
      fetcher: async () => {
        count++;
        return Response.json(
          { state: "queued", request_id: ID },
          { status: 202 },
        );
      },
    }),
    (error) => error.code === "queued",
  );
  assert.equal(count, 1);
  await assert.rejects(
    requestCampaignDraft(client, input, {
      requestId: ID,
      fetcher: async () =>
        Response.json(
          { state: "queued", request_id: "other-request" },
          { status: 202 },
        ),
    }),
    /could not be confirmed/,
  );
});
test("failed native requests retain their request reference on explicit retry and do not use another backend", async () => {
  const requests = [];
  const fetcher = async (_url, options) => {
    requests.push(JSON.parse(options.body).request_id);
    return Response.json({ error: "Capacity busy" }, { status: 503 });
  };
  await assert.rejects(
    requestCampaignDraft(client, input, { requestId: ID, fetcher }),
    /Capacity busy/,
  );
  await assert.rejects(
    requestCampaignDraft(client, input, { requestId: ID, fetcher }),
    /Capacity busy/,
  );
  assert.deepEqual(requests, [ID, ID]);
});
test("section rewriting preserves the whole returned section and its distinct contract", async () => {
  const section =
    "A revised first paragraph.\n\nA second paragraph retaining the same facts.";
  const result = await requestCampaignDraft(
    client,
    { ...input, section: "Original section" },
    {
      requestId: ID,
      fetcher: async (_url, options) => {
        assert.equal(JSON.parse(options.body).section, "Original section");
        return Response.json({
          section,
          assistance: "assisted",
          ai_inference: true,
        });
      },
    },
  );
  assert.equal(result.story, section);
  assert.throws(
    () => validateDraftSuggestion({ ...suggestion("outline"), section }, true),
    /incomplete section/,
  );
});
test("late responses cannot be attributed to a different signed-in account", async () => {
  let reads = 0;
  const switching = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: "test",
            user: { id: ++reads === 1 ? "owner-a" : "owner-b" },
          },
        },
      }),
    },
  };
  await assert.rejects(
    requestCampaignDraft(switching, input, {
      requestId: ID,
      fetcher: async () => Response.json(suggestion()),
    }),
    /account changed/,
  );
});

test("section regeneration uses the permanent preview service and carries its owned campaign reference", async () => {
  const result = await requestCampaignSection(
    client,
    {
      details: input.details,
      section: "Original section",
      campaign_id: ID,
    },
    {
      requestId: ID,
      fetcher: async (url, options) => {
        assert.equal(url, "/api/services/story_agent/campaign-preview");
        const body = JSON.parse(options.body);
        assert.equal(body.campaign_id, ID);
        assert.equal(body.section, "Original section");
        return Response.json({
          section: "A revised section.",
          assistance: "assisted",
          ai_inference: true,
        });
      },
    },
  );
  assert.deepEqual(result, { section: "A revised section." });
});
