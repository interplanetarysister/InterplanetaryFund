import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeMediaResponse, evaluatePostDraft, summarizeAudienceFeedback } from "../src/lib/audiencePostReview.mjs";
const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("existing route owns publishing workspace and legacy media URLs still work", () => {
  const app = read("src/App.jsx");
  const studio = read("src/pages/PublishingWorkspace.jsx");
  assert.match(app, /path="\/communications" element=\{<MemberAccess><PublishingWorkspace/);
  assert.match(app, /path="\/ai-images" element=\{<MemberAccess><Navigate to="\/communications\?tab=media&tool=artwork"/);
  for (const id of ["messages", "media", "audience", "review"]) assert.match(studio, new RegExp('id: "' + id + '"'));
  assert.match(studio, /<CommunicationsWorkspace embedded/);
  assert.match(studio, /<CreatorMediaTools/);
  assert.match(studio, /<AudienceReviewBench/);
});

test("media optimization is a subtab rather than a separate route or observed audience test", () => {
  const media = read("src/components/communications/CreatorMediaTools.jsx");
  const optimizer = read("src/components/communications/PrePostMediaOptimizer.jsx");
  const audience = read("src/components/communications/AudienceReviewBench.jsx");
  assert.match(media, /\["optimization", "Pre-post Optimization"\]/);
  assert.match(media, /<PrePostMediaOptimizer/);
  assert.match(media, /<AudioClipEditor/);
  assert.match(optimizer, /Media psychology analysis/);
  assert.match(optimizer, /Platform-specific optimization/);
  assert.match(optimizer, /PLATFORM_PROFILES/);
  assert.match(audience, /Record an actual reviewer/);
  assert.doesNotMatch(optimizer, /publishPost\(|\.rpc\(|auth\.signIn|\/api\/.*publish/);
});

test("existing owner and review controls remain in reused components", () => {
  const messages = read("src/pages/CommunicationsWorkspace.jsx");
  const artwork = read("src/pages/AIImageStudio.jsx");
  assert.match(messages, /eq\("owner_id",user\.id\)/);
  assert.match(messages, /EchoApprovedMessaging/);
  assert.match(artwork, /uploadCampaignCover/);
  assert.match(artwork, /ifund_ai_image_access_status/);
});

test("media psychology separates attention, memory, action and audio without fake probabilities", () => {
  const a = analyzeMediaResponse({
    text: "Help fund our community science project because we need classroom supplies. Share with friends.",
    seconds: 32,
    format: "short-video",
    audience: "Science teachers",
    audio: true,
    captions: false,
  });
  assert.equal(a.calibrated, false);
  assert.equal(a.probabilities, null);
  assert.equal(a.format, "short-video");
  assert.equal(a.audience, "Science teachers");
  const outcomes = a.signals.map(x => x.outcome);
  for (const expected of ["Initial attention", "Continued attention", "Delayed recall", "Willingness to engage", "Emotional resonance & trust", "Audio and sound design"]) assert.ok(outcomes.includes(expected));
  assert.match(a.signals.find(s => s.outcome === "Audio and sound design").limitation, /Hz alone/);
});

test("actual audience averages use only valid reviewer responses", () => {
  assert.deepEqual(summarizeAudienceFeedback([5,4,0,6,NaN,-1]), { count:2, mean:4.5 });
  assert.equal(evaluatePostDraft("").score, null);
});

test("production preflight performs no network deployment and fails closed", () => {
  const script = read("../../scripts/preflight-production.mjs");
  assert.match(script, /process\.exit\(1\)/);
  assert.match(script, /Web complete regression suite/);
  assert.match(script, /Web production compilation \(local only\)/);
  assert.doesNotMatch(script, /wrangler pages deploy|cloudflare\.request|\/deployments|git push/);
});
