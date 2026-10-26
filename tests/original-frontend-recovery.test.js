import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("IFund introduction keeps complete original story and source CTAs", () => {
  const home = file("../src/pages/Feed.jsx");
  for (const text of [
    "Endless possibilities start with one question:",
    "One place to ask for help — or make something possible.",
    "Read more · Our Story", "Show less",
    "The problem we're solving", "Our ambition is global",
    "Join Founding Members", "Who is Interplanetary Fund?",
  ]) assert.ok(home.includes(text), text);
  assert.ok(home.includes('aria-expanded={expanded}'));
});
test("founding enrollment is opt-in and cannot claim signup without verified receipt", () => {
  const page = file("../src/pages/FoundingMembers.jsx");
  assert.ok(page.includes("VITE_IFUND_FOUNDING_ENROLLMENT_ENABLED"));
  assert.ok(page.includes('db.rpc("ifund_join_founding_waitlist"'));
  assert.ok(page.includes("if (error || !data?.ok)"));
  assert.ok(page.includes("!enrollmentEnabled || !db"));
});
test("original social symbols are local SVG assets", () => {
  for (const id of ["facebook","instagram","youtube","tiktok","reddit","x","linkedin","pinterest","gofundme"]) {
    assert.ok(existsSync(new URL("../public/platform-logos/" + id + ".svg", import.meta.url)), id);
  }
  assert.ok(file("../src/pages/Feed.jsx").includes("/platform-logos/"));
});
test("sharing a fundraiser uses canonical links but cannot create a payment", () => {
  const sharing = file("../src/components/CampaignSharing.jsx");
  assert.ok(sharing.includes('if (status !== "active") return null'));
  assert.ok(sharing.includes('"/embed/campaign/"'));
  assert.ok(sharing.includes("navigator.clipboard"));
  assert.doesNotMatch(sharing, /captureOrder|createPayment|checkout|base44Client/);
});
