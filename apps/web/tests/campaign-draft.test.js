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
});
test("draft responses require usable story text", () => {
  assert.throws(() => validateDraftSuggestion({ titles: [], summaries: [] }), /incomplete/);
  assert.equal(validateDraftSuggestion({ titles:["Title"], summaries:["Summary"], story:"Story" }).story, "Story");
});
test("draft generation requires authentication and never saves", async () => {
  await assert.rejects(requestCampaignDraft({ auth: { getSession: async () => ({ data: {} }) } }, { details: "A real detailed explanation" }), /sign in/);
  let called = false;
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: "abc" } } }) },
    functions: { invoke: async (name, options) => {
      called = true;
      assert.equal(name, "ifund-campaign-draft-preview");
      assert.ok(options.body.details);
      return { data: {titles:["Title"],summaries:["Summary"],story:"Story"} };
    } } };
  assert.equal((await requestCampaignDraft(client, {details:"Garden community fundraising story"})).story, "Story");
  assert.equal(called, true);
});
