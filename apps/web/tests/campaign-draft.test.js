import test from "node:test";
import assert from "node:assert/strict";
import { makeDraftRequest, validateDraftSuggestion, requestCampaignDraft } from "../src/api/campaignDraft.js";

test("draft requests reject empty details and cap user input", () => {
  assert.throws(() => makeDraftRequest({ details: "short" }), /12 characters/);
  const payload = makeDraftRequest({
    details: "  Help equip a neighborhood garden with tools  ",
    beneficiary: "Neighbors", need: "Garden tools", cause: "community", goal: 600
  });
  assert.equal(payload.answers.need, "Garden tools");
  assert.equal(payload.goal, 600);
  assert.throws(() => makeDraftRequest({
    details: "A complete and useful campaign description",
    beneficiary: "B".repeat(101),
  }), /was not shortened/);
});
test("draft responses require usable story text", () => {
  assert.throws(() => validateDraftSuggestion({ titles: [], summaries: [] }), /incomplete/);
  const valid = validateDraftSuggestion({
    titles: ["Title A", "Title B", "Title C", "Title D", "Title E"],
    summaries: ["Summary A", "Summary B"],
    story: "Story",
  });
  assert.equal(valid.story, "Story");
  assert.equal(valid.titles.length, 5);
  assert.equal(valid.summaries.length, 2);
});
test("draft generation requires authentication and never saves", async () => {
  await assert.rejects(requestCampaignDraft({ auth: { getSession: async () => ({ data: {} }) } }, { details: "A real detailed explanation" }), /sign in/);
  let called = false;
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: "abc" } } }) },
    functions: { invoke: async (name, options) => {
      called = true;
      assert.equal(name, "ifund-campaign-draft-preview");
      assert.ok(options.body.details);
      return { data: {
        titles: ["Title A", "Title B", "Title C", "Title D", "Title E"],
        summaries: ["Summary A", "Summary B"],
        story: "Story",
      } };
    } } };
  assert.equal((await requestCampaignDraft(client, {details:"Garden community fundraising story"})).story, "Story");
  assert.equal(called, true);
});

test("section regeneration respects the workforce 4,000-character bound without mutating saved text", async () => {
  const { requestCampaignSection } = await import("../src/api/campaignDraft.js");
  const previousFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return Response.json({ draft: { payload: { section: "Replacement story section" } } }, { status: 201 });
  };
  try {
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "signed-session" } },
          error: null,
        }),
      },
    };
    const result = await requestCampaignSection(client, {
      details: "Verified campaign facts for section regeneration",
      section: "S".repeat(4000),
    });
    assert.equal(result.section, "Replacement story section");
    assert.equal(request.url, "/api/services/story_agent/drafts");
    assert.equal(request.body.section.length, 4000);
    assert.match(request.body.request_id, /^[0-9a-f-]{36}$/i);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("section regeneration rejects responses beyond the workforce output bound", async () => {
  const { requestCampaignSection } = await import("../src/api/campaignDraft.js");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ draft: { payload: { section: "R".repeat(4001) } } }, { status: 201 });
  try {
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "signed-session" } },
          error: null,
        }),
      },
    };
    await assert.rejects(
      requestCampaignSection(client, {
        details: "Verified campaign facts for section regeneration",
        section: "Original section",
      }),
      /invalid section/,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
