import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (name) => readFileSync(new URL("../src/pages/" + name, import.meta.url), "utf8");
test("guided campaign editor preserves draft, validation, and owner identity", () => {
  const editor = src("CampaignEditor.jsx");
  for (const value of ["Your Details","Basics","Your Story","Launch","Review &amp; launch",
    "Show five AI title options","Show five AI description options",
    "Story Forge","Save draft","Publish campaign", "canSaveCampaign"]) {
    assert.ok(editor.includes(value), value);
  }
  assert.match(editor, /disabled[^>]*>Forge my story/);
});
test("identity recovery defaults off, never creates unverified legacy members", () => {
  const auth = src("Auth.jsx");
  assert.ok(auth.includes("VITE_IFUND_AUTH_SIGNIN_ENABLED"));
  assert.ok(auth.includes("shouldCreateUser: false"));
  assert.ok(auth.includes('!requestedReturn.startsWith("//")'));
  assert.ok(auth.includes('navigate(returnTo, { replace: true })'));
});
test("About restores original four descriptive sections", () => {
  const about = src("About.jsx");
  for (const value of ["What we do","Who it is for","Who builds it","Fund a healthier planet"]) {
    assert.ok(about.includes(value), value);
  }
});
