import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const component = read("../src/components/campaigns/CampaignImageChoices.jsx");

// D8 regression: a finished generation was silently discarded when the
// editor's title/description/style props changed mid-flight (the [title,
// description, style] effect bumped the request token via clear()), even
// though the server had already charged the trial allowance for it.
test("prop-churn effect does not invalidate an in-flight request", () => {
  assert.match(component, /useEffect\(\(\)=>\{if\(!busy\.current\)clear\(\);\},\[title,description,style\]\);/);
});

test("a discarded generation explains itself instead of vanishing silently", () => {
  assert.match(component, /if\(token!==id\.current\)\{setMessage\("Your artwork finished, but the image settings changed while it was being created, so that result was discarded\./);
});

test("a discarded apply also explains itself", () => {
  assert.match(component, /if\(token!==id\.current\)\{setMessage\("The illustration uploaded, but the campaign changed while it was saving, so it was not applied\."\);return;\}/);
});
