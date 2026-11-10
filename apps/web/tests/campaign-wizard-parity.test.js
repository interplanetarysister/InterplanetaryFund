import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("campaign creator presents the four original Base44 stages", () => {
  for (const stage of ["Your Details", "Basics", "Your Story", "Launch"]) {
    assert.ok(source.includes(`"${stage}"`), `missing stage: ${stage}`);
  }
  assert.match(source, /aria-current=\{step === index \? "step" : undefined\}/);
  assert.match(source, /setStep\(s => Math\.max\(0, s - 1\)\)/);
  assert.match(source, /setStep\(s => Math\.min\(3, s \+ 1\)\)/);
});

test("private drafts remain saveable from every stage and guests retain a local start", () => {
  assert.match(source, /step !== 3 && <div/);
  assert.match(source, /onClick=\{\(\) => save\("draft"\)\}/);
  assert.match(source, /rememberBrowserCampaign\(sessionStorage, ownerId, form/);
  assert.match(source, /event\.preventDefault\(\); save\("draft"\)/);
});

test("launch is gated behind review and still uses owner-scoped save", () => {
  assert.match(source, /step === 3 && <section aria-label="Campaign launch preview"/);
  assert.match(source, /step === 3 && <section aria-label="Save or publish campaign"/);
  assert.match(source, /saveOwnerCampaign\(client, form,/);
  assert.doesNotMatch(source, /base44\.functions|base44\.entities|base44Client/);
});

test("the four-stage navigator keeps the original icon language without skipping fields", () => {
  assert.match(source, /UserRound, Target, BookOpen, Rocket/);
  assert.match(source, /Step \{step \+ 1\} of 4/);
  assert.match(source, /step === 1 && !\(Number\(form\.goal_amount\) > 0\)/);
  assert.match(source, /step === 2 && !form\.title\.trim\(\)/);
  assert.match(source, /aria-label="Campaign creation progress"/);
});
