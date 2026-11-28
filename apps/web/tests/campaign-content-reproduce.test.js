import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCampaignWritingRequests } from "../src/lib/campaignWritingRequests.js";
import { makeDraftRequest } from "../src/api/campaignDraft.js";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

// --- writingSuggestion: request-reference lifecycle -------------------------
// The retained request reference is what makes a retry resume instead of
// double-charging (idempotent server begin). A deliberate re-produce must
// retire it so the server performs — and the allowance charges — a new
// generation; a plain retry must keep it.
function writingHarness(behavior) {
  const calls = [];
  const names = {
    wizard: { ai_profile: { tone: "", never_change: "" } },
    ownerId: null, draftId: null, saved: "",
    campaignId: { current: null },
    writingRequests: { current: new Map() },
    makeDraftRequest,
    authClient: () => ({}),
    requestCampaignDraft: async (client, input, { requestId }) => {
      calls.push({ input, requestId });
      return behavior(calls.length, input, requestId);
    },
  };
  const start = source.indexOf("  async function writingSuggestion(input");
  const end = source.indexOf("\n  async function regenerateSection", start);
  assert.ok(start >= 0 && end > start);
  const fn = new Function(...Object.keys(names), source.slice(start, end) + ";return writingSuggestion;")(...Object.values(names));
  return { fn, calls, writingRequests: names.writingRequests };
}
const brief = { details: "A community garden needs accessible equipment and soil.", beneficiary: "local families", need: "raised beds", cause: "community", goal: 500 };

test("a plain retry after a failure reuses the retained request reference", async () => {
  const h = writingHarness(() => { throw new Error("network lost"); });
  await assert.rejects(h.fn(brief), /network lost/);
  await assert.rejects(h.fn(brief), /network lost/);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].requestId, h.calls[0].requestId, "retry resumes the same request instead of charging a second generation");
});

test("a deliberate re-produce retires the reference and generates under a new one", async () => {
  const h = writingHarness(() => { throw new Error("network lost"); });
  await assert.rejects(h.fn(brief), /network lost/);
  await assert.rejects(h.fn(brief, true), /network lost/);
  assert.notEqual(h.calls[1].requestId, h.calls[0].requestId, "fresh generation must not replay the retained request");
});

test("two successful generations in a row use distinct request references", async () => {
  const h = writingHarness(() => ({ ai_inference: false, story: "A generated story." }));
  await h.fn(brief);
  await h.fn(brief);
  assert.equal(h.calls.length, 2);
  assert.notEqual(h.calls[1].requestId, h.calls[0].requestId, "each completed generation retires its reference");
});

test("the version direction rides writing preferences and keys its own request", async () => {
  const h = writingHarness(() => { throw new Error("network lost"); });
  await assert.rejects(h.fn({ ...brief, adjustment: " Shorter and more urgent. " }), /network lost/);
  assert.equal(h.calls[0].input.writing_preferences.adjustment, "Shorter and more urgent.");
  assert.equal("adjustment" in h.calls[0].input, false, "direction is not a top-level draft field");
  await assert.rejects(h.fn(brief), /network lost/);
  assert.equal("adjustment" in h.calls[1].input.writing_preferences, false);
  assert.notEqual(h.calls[1].requestId, h.calls[0].requestId, "changing the direction is a different request, never a hash conflict on the old one");
  // Without a direction the preferences keep their established shape.
  const plain = writingHarness(() => ({ ai_inference: false }));
  await plain.fn(brief);
  assert.deepEqual(plain.calls[0].input.writing_preferences, { tone: "", never_change: "" });
});

// --- suggestDraft: suggestions never touch the member's story sections -----
function suggestHarness() {
  const guard = createCampaignWritingRequests();
  const state = { suggestions: null, sections: ["Member paragraph one.", "Member paragraph two."], sectionSetterCalls: 0 };
  const suggestionCalls = [];
  const names = {
    privacyDecisionPending: false, busy: false, suggesting: false,
    loadingDraft: false, draftLoadError: "",
    writingLock: { current: false }, writingRevision: { current: guard }, alive: { current: true },
    storySectionsRef: { current: [...state.sections] },
    draftDetails: "A community garden needs accessible equipment.", draftBeneficiary: "local families",
    draftNeed: "raised beds", draftAdjustment: "Shorter and more urgent.", writingPath: "write",
    form: { category: "community", goal_amount: "500" },
    guidedCampaignDetails: (path, details) => details,
    splitStory: value => String(value).split(/\n\s*\n/),
    writingSuggestion: async (input, fresh) => {
      suggestionCalls.push({ input, fresh });
      return { story: "Suggested replacement story.", titles: [], summaries: [] };
    },
    setSuggesting() {}, setSuggestionError() {}, setWritingQueued() {},
    setSuggestions: value => { state.suggestions = value; },
    setSectionProposals() {},
    setStorySections: () => { state.sectionSetterCalls += 1; },
  };
  const start = source.search(/async function suggestDraft\(/);
  const end = source.indexOf("useEffect(() => {", start + 1);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  const fn = new Function(...Object.keys(names), body + ";return suggestDraft;")(...Object.values(names));
  return { fn, state, suggestionCalls, names, body };
}

test("a successful suggestion leaves the member's story sections exactly as they were", async () => {
  const h = suggestHarness();
  await h.fn();
  assert.equal(h.state.suggestions.story, "Suggested replacement story.");
  assert.equal(h.state.sectionSetterCalls, 0, "suggestDraft must not replace the section list");
  assert.deepEqual(h.names.storySectionsRef.current, ["Member paragraph one.", "Member paragraph two."],
    "sections stay derived from the member's current story, so a later section edit cannot overwrite it with suggestion text");
  assert.doesNotMatch(h.body, /splitStory\(result\.story\)/, "the suggestion's sections are never installed as the member's sections");
});

test("re-produce passes the direction and the fresh flag to the writing request", async () => {
  const h = suggestHarness();
  await h.fn();
  assert.equal(h.suggestionCalls[0].fresh, false);
  assert.equal(h.suggestionCalls[0].input.adjustment, "Shorter and more urgent.");
  await h.fn(true);
  assert.equal(h.suggestionCalls[1].fresh, true, "Generate a new version forces a brand-new generation");
});

// --- restored controls are present in the creation flow ---------------------
test("the creation flow exposes adjust and re-produce controls", () => {
  assert.match(source, /Direction for the next version \(optional\)/);
  assert.match(source, /maxLength=\{300\} value=\{draftAdjustment\}/);
  assert.match(source, /Generate a new version/);
  assert.match(source, /Suggest another revision/);
  assert.match(source, /onClick=\{\(\)=>suggestDraft\(Boolean\(suggestions\)\)\}/);
  assert.match(source, /onClick=\{\(\)=>regenerateSection\(i,true\)\}/);
  // Generated content lands in fields the member can edit directly.
  assert.match(source, /id="campaign-story"[\s\S]{0,220}onChange=\{e=>change\("story",e\.target\.value\)\}/);
  assert.match(source, /id="campaign-summary"[\s\S]{0,220}onChange=\{e=>change\("summary",e\.target\.value\)\}/);
  assert.match(source, /id="campaign-title"[\s\S]{0,220}onChange=\{e=>change\("title",e\.target\.value\)\}/);
});
