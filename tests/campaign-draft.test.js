import test from "node:test";
import assert from "node:assert/strict";
import { campaignDraftRequest, normalizeCampaignDraft, generateCampaignDraft } from "../src/lib/campaignDraft.js";

test("draft request validates useful details and limits input", () => {
  assert.throws(() => campaignDraftRequest({ details: "short" }), /12 characters/);
  const request = campaignDraftRequest({
    details: "A community garden needs materials for new raised beds.",
    need: "raised beds", beneficiary: "local families", cause: "community",
    goal: 1200,
  });
  assert.equal(request.answers.beneficiary, "local families");
  assert.equal(request.goal, 1200);
  assert.equal(request.details.length > 12, true);
});

test("draft response cannot silently accept incomplete or malformed data", () => {
  assert.throws(() => normalizeCampaignDraft({ titles: [], summaries: [], story: "" }), /incomplete/);
  assert.throws(() => normalizeCampaignDraft(null), /unexpected/);
  const response = normalizeCampaignDraft({
    titles: [" First title ", "Another"], summaries: ["First summary"],
    story: "A story", ai_inference: false,
  });
  assert.equal(response.titles[0], " First title ");
  assert.equal(response.aiInference, false);
});

test("draft generation requires a real signed-in session", async () => {
  const db = { auth: { getSession: async () => ({ data: { session: null } }) } };
  await assert.rejects(
    generateCampaignDraft(db, { details: "My campaign requires your assistance." }),
    /Sign in/,
  );
});

test("draft generation calls the existing function but never writes data", async () => {
  let invoked = false;
  const db = {
    auth: { getSession: async () => ({ data: { session: { access_token: "test" } } }) },
    functions: { invoke: async (slug, options) => {
      invoked = true;
      assert.equal(slug, "ifund-campaign-draft-preview");
      assert.equal(options.body.answers.cause, "education");
      return { data: { titles: ["School supplies"], summaries: ["Help with supplies"], story: "Our story" }, error: null };
    } },
  };
  const data = await generateCampaignDraft(db, { details: "We need supplies for our school.", cause: "education" });
  assert.equal(invoked, true);
  assert.equal(data.titles[0], "School supplies");
});
