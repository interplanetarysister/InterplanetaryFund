import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const publicPlans = read("../src/pages/PublicSubscriptionPlans.jsx");

// D9 regression: the public /plans catalog rendered "Sign in to subscribe"
// for every visitor because it never read auth state. Signed-in members were
// routed to /login (which does not bounce an existing session onward).
test("plans page resolves the visitor session through the shared auth client", () => {
  assert.match(publicPlans, /import \{ authClient \} from "@\/api\/auth";/);
  assert.match(publicPlans, /authClient\(\)\.auth\.getSession\(\)/);
  assert.match(publicPlans, /setSignedIn\(!error && Boolean\(data\?\.session\)\)/);
});

test("signed-in members get a Subscribe link straight to /subscriptions", () => {
  assert.match(publicPlans, /to="\/subscriptions">Subscribe<\/Link>/);
});

test("signed-out visitors keep the sign-in CTA with the subscriptions return path", () => {
  assert.match(publicPlans, /to=\{"\/login\?returnTo=" \+ returnTo\}>Sign in to subscribe<\/Link>/);
  assert.match(publicPlans, /encodeURIComponent\("\/subscriptions"\)/);
});
