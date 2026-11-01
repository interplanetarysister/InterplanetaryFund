import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apiSource = readFileSync(new URL("../src/lib/campaignDraftApi.js", import.meta.url), "utf8");
const wizardSource = readFileSync(new URL("../src/components/campaigns/GuidedCampaignWizard.jsx", import.meta.url), "utf8");

// Execute the real API function with a stubbed Supabase client, without Vite
// alias resolution or a network call. This is a contract test, not browser E2E.
function apiHarness(reply) {
  const calls = [];
  const executable = apiSource
    .replace(/^import \{ authClient \} from "@\/api\/auth";\s*/m, "")
    .replace("export async function requestCampaignDraft", "async function requestCampaignDraft");
  const requestCampaignDraft = new Function("authClient", executable + "\nreturn requestCampaignDraft;")(
    () => ({ functions: { invoke: async (slug, options) => {
      calls.push({ slug, body: options.body });
      return { data: typeof reply === "function" ? reply(options.body) : reply, error: null };
    } } }),
  );
  return { requestCampaignDraft, calls };
}
const sample = { answers: { cause: "Community initiative" }, details: "Neighborhood cleanup equipment is needed.", goal: 300 };
const result = (variation) => ({
  titles: ["Title one", "Title two", "Title three", "Title four", "Title five"],
  summaries: ["Summary one", "Summary two"], story: "Grounded story",
  variation, ai_inference: false, image_rendered: false,
});

test("preview API forwards bounded variation to the same authenticated endpoint", async () => {
  const h = apiHarness(body => result(body.variation));
  await h.requestCampaignDraft({ ...sample, variation: 3 });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].slug, "ifund-campaign-draft-preview");
  assert.equal(h.calls[0].body.variation, 3);
  await assert.rejects(h.requestCampaignDraft({ ...sample, variation: 5 }), /Invalid campaign preview variation/);
  assert.equal(h.calls.length, 1);
});
test("older deployed preview cannot silently pretend to offer a new set", async () => {
  const old = apiHarness(result(undefined));
  await old.requestCampaignDraft(sample); // legacy initial preview remains compatible
  await assert.rejects(old.requestCampaignDraft({ ...sample, variation: 1 }), /not yet available/);
});
test("wizard locks overlapping requests and preserves an edited story", () => {
  assert.match(wizardSource, /if \(inFlight\.current \|\| !copy\) return/);
  assert.match(wizardSource, /requestId !== requestVersion\.current/);
  assert.match(wizardSource, /story: storyEdited \? previous\.story : result\.story/);
  assert.match(wizardSource, /disabled=\{requesting\}[^>]*>Use selected campaign content/);
  assert.match(wizardSource, /role="alert"[^>]*>\{error\}/);
});
