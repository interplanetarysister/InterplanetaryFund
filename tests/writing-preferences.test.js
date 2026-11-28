import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWritingPreferences } from "../worker/agents/writingPreferences.js";
import { storyInput, storyMessages } from "../worker/agents/story.js";
import { campaignPreview, campaignPreviewInput } from "../worker/services/campaign-preview.js";

const id = "33333333-3333-4333-8333-333333333333";
const base = { request_id: id, details: "A community garden needs accessible equipment." };
test("optional preferences preserve the old input and replay-hash shape", () => {
  assert.equal("writing_preferences" in storyInput(base), false);
  assert.equal("writing_preferences" in campaignPreviewInput(base), false);
  assert.equal(normalizeWritingPreferences({ tone: " ", never_change: "" }), undefined);
  assert.deepEqual(normalizeWritingPreferences({ tone: " Warm ", never_change: "Keep the exact garden name." }),
    { tone: "Warm", never_change: "Keep the exact garden name." });
});
test("preferences reject authority fields, overlong values, nonstrings and control characters", () => {
  for (const writing_preferences of [null, [], "warm", { owner_id: id }, { tone: 123 },
    { tone: "x".repeat(201) }, { never_change: "x".repeat(2001) }, { never_change: "bad\u0000value" }]) {
    assert.throws(() => storyInput({ ...base, writing_preferences }), error => error.status === 400);
    assert.throws(() => campaignPreviewInput({ ...base, writing_preferences }), error => error.status === 400);
  }
});
test("long preferences and section context reach native Story without truncating facts", async () => {
  const calls = [];
  const writing_preferences = { tone: "W".repeat(200), never_change: "N".repeat(2000) };
  const details = "F".repeat(1500);
  const section = "Preserve the natural scope of this section.";
  const request = new Request("https://ifund.test/api/services/story_agent/campaign-preview", {
    method: "POST", headers: { authorization: "Bearer test.jwt", "content-type": "application/json" },
    body: JSON.stringify({ ...base, details, section, writing_preferences }),
  });
  const response = await campaignPreview(request, { SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"mock-key",IFUND_STORY_AGENT: { fetch: async forwarded => {
    if (forwarded.method === "GET") return Response.json({ active: true, level: 1 });
    calls.push(await forwarded.json());
    return Response.json({ draft: { id, payload: { section: "A reviewed rewritten section." } } }, { status: 201 });
  } } }, (url) => {
    if(String(url).endsWith("/ifund_ai_content_reserve"))
      return Promise.resolve(Response.json({allowed:true,state:"reserved",remaining:14}));
    if(String(url).endsWith("/ifund_ai_content_complete"))
      return Promise.resolve(Response.json(true));
    if(String(url).endsWith("/ifund_trial_ai_generation_release"))
      return Promise.resolve(Response.json(true));
    throw Error("Unexpected quota service request");
  });
  assert.equal(response.status, 200);
  assert.equal(calls[0].details, details);
  assert.equal(calls[0].section, section);
  assert.deepEqual(calls[0].writing_preferences, writing_preferences);
  assert.equal(storyInput(calls[0]).writing_preferences.never_change.length, 2000);
});
test("model context labels style preferences as untrusted and excludes credentials in every source", () => {
  const input = storyInput({ ...base, section: "Keep this section. Bearer synthetic-secret-123",
    writing_preferences: { tone: "Warm", never_change: 'Keep the garden name; {"access_token":"synthetic-secret-123"}' } });
  const messages = storyMessages(input, { campaign: { title: "A factual garden", story: "PAYPAL_CLIENT_SECRET=synthetic-secret-123" },
    preferences: [{ key: "tone", provenance: "owner_statement", value: "Bearer synthetic-secret-123" }],
    shared_agent_history: [{ agent_id: "orbit", content: "access_token=synthetic-secret-123" }] });
  assert.doesNotMatch(JSON.stringify(messages), /synthetic-secret-123/);
  const user = JSON.parse(messages.find(item => item.role === "user").content);
  assert.equal(user.organizer_details, base.details);
  assert.equal(user.organizer_writing_preferences.source, "organizer_supplied_untrusted_style_data");
  assert.equal(user.organizer_writing_preferences.tone, "Warm");
  assert.equal(messages.filter(item => item.role === "system").length, 1);
});
test("a version direction (adjustment) is optional, trimmed, and absent when not supplied", () => {
  // Requests without a direction keep the exact pre-adjustment shape, so
  // their Story input hash and replay behavior are unchanged.
  assert.deepEqual(normalizeWritingPreferences({ tone: "Warm" }), { tone: "Warm", never_change: "" });
  assert.equal(normalizeWritingPreferences({ adjustment: "   " }), undefined);
  assert.deepEqual(normalizeWritingPreferences({ adjustment: " Make it shorter and more urgent. " }),
    { tone: "", never_change: "", adjustment: "Make it shorter and more urgent." });
  assert.equal("adjustment" in storyInput(base), false);
  assert.equal(storyInput({ ...base, writing_preferences: { adjustment: "Emphasize the deadline." } })
    .writing_preferences.adjustment, "Emphasize the deadline.");
  assert.equal(campaignPreviewInput({ ...base, writing_preferences: { adjustment: "Shorter." } })
    .writing_preferences.adjustment, "Shorter.");
});
test("a version direction rejects overlong values, nonstrings and control characters", () => {
  for (const writing_preferences of [{ adjustment: "x".repeat(301) }, { adjustment: 42 },
    { adjustment: "bad\u0000value" }, { adjustment: "fine", role: "admin" }]) {
    assert.throws(() => storyInput({ ...base, writing_preferences }), error => error.status === 400);
    assert.throws(() => campaignPreviewInput({ ...base, writing_preferences }), error => error.status === 400);
  }
});
test("a version direction reaches native Story through the preview unchanged", async () => {
  const calls = [];
  const request = new Request("https://ifund.test/api/services/story_agent/campaign-preview", {
    method: "POST", headers: { authorization: "Bearer test.jwt", "content-type": "application/json" },
    body: JSON.stringify({ ...base, writing_preferences: { adjustment: "Shorter, and emphasize the Friday deadline." } }),
  });
  const response = await campaignPreview(request, { SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"mock-key",IFUND_STORY_AGENT: { fetch: async forwarded => {
    if (forwarded.method === "GET") return Response.json({ active: true, level: 1 });
    calls.push(await forwarded.json());
    return Response.json({ draft: { id, payload: { titles: ["One","Two","Three","Four","Five"], summaries: ["First","Second"],
      story: "A truthful garden story with enough detail to pass the minimum length contract for AI drafts. ".repeat(12).trim(),
      image_prompt: "A symbolic garden." } } }, { status: 201 });
  } } }, (url) => {
    if(String(url).endsWith("/ifund_ai_content_reserve"))
      return Promise.resolve(Response.json({allowed:true,state:"reserved",remaining:14}));
    if(String(url).endsWith("/ifund_ai_content_complete"))
      return Promise.resolve(Response.json(true));
    if(String(url).endsWith("/ifund_trial_ai_generation_release"))
      return Promise.resolve(Response.json(true));
    throw Error("Unexpected quota service request");
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].writing_preferences.adjustment, "Shorter, and emphasize the Friday deadline.");
  // The Story prompt carries the direction as organizer style data.
  const messages = storyMessages(storyInput(calls[0]), {});
  const user = JSON.parse(messages.find(item => item.role === "user").content);
  assert.equal(user.organizer_writing_preferences.adjustment, "Shorter, and emphasize the Friday deadline.");
});
