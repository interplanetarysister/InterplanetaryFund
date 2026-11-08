import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/Onboarding.jsx", import.meta.url), "utf8");

test("onboarding restores the six-step member journey without granting delegated authority", () => {
  assert.match(page, /Step \{step\+1\} of 6/);
  for (const step of [0, 1, 2, 3, 4, 5]) {
    assert.ok(page.includes(`step===${step}`), `step ${step} is rendered`);
  }
  assert.match(page, /Meet your AI team/);
  assert.match(page, /Connect your platforms/);
  assert.match(page, /Automation stays under your control/);
  assert.match(page, /to="\/agents"/);
  assert.match(page, /to="\/connections"/);
  assert.doesNotMatch(page, /setUnifiedOboConsent|delegated_operations_enabled|onboarding_completed/);
});
