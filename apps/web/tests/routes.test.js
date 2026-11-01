import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = file("../src/App.jsx");
test("independent user-facing routes are explicitly implemented", () => {
 for (const route of ["/login","/register","/forgot-password","/reset-password","/dashboard","/profile","/connections","/social","/community","/create"]) {
  assert.ok(app.includes(`<Route path="${route}" element={`), route);
 }
});
test("implemented pages do not import Base44 client", () => {
 for (const name of ["AuthPage","ResetPassword","Dashboard","Profile","Connections","SocialFeedPage","CreateCampaign"]) {
  assert.doesNotMatch(file(`../src/pages/${name}.jsx`), /base44Client|base44\.functions|base44\.entities/, name);
 }
});
test("auth client targets one canonical Supabase project", () => {
 const auth = file("../src/api/auth.js");
 assert.match(auth, /ssibsfmtodgximseeqsv/);
 assert.match(auth, /VITE_SUPABASE_PUBLISHABLE_KEY/);
 assert.doesNotMatch(auth, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test("fundraising is never represented as confirmed by draft creation", () => {
 const create = file("../src/pages/CreateCampaign.jsx");
 const publication = file("../src/lib/campaignPublication.js");
 assert.match(create, /persistCampaignContent/);
 assert.match(publication, /status:publish\?"active":"draft"/);
 assert.doesNotMatch(create, /base44Client|base44\\.functions/);
});
