import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const preview = read("./campaign-preview.js");

// D7 regression: a membership denial (an expected account state) was dressed
// up as "Your AI generation allowance could not be verified." Every denial
// state from ifund_ai_content_reserve now maps to its own status + message.
test("membership_required is a 403 with a membership explanation, not a verification failure", () => {
  assert.match(preview, /membership_required:\[403,"AI writing help needs a trial or a subscription with AI included\./);
});

test("trial_limit keeps its 429 free-pool exhaustion message", () => {
  assert.match(preview, /trial_limit:\[429,"Your 15 free AI creations for this week are used\./);
});

test("monthly_limit is a 429 with a plan-limit explanation", () => {
  assert.match(preview, /monthly_limit:\[429,"You have reached this month's AI creation limit for your plan\./);
});

test("the generic verification-failure copy is reserved for the unavailable fallback", () => {
  assert.match(preview, /\|\|\[503,"Your AI generation allowance could not be verified\. Your current text is unchanged\."\]/);
});