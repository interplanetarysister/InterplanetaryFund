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
 assert.match(create, /status: "draft"/);
 assert.doesNotMatch(create, /status: "active"/);
});
test("the implemented reporter workspace route is not duplicated as Coming Soon", () => {
 const implementedRoute =
  '<Route path="/my-blog" element={<MemberAccess><MyPublication /></MemberAccess>} />';
 assert.ok(app.includes(implementedRoute));

 const start = app.indexOf("const LAYOUT_COMING_SOON = [");
 assert.notEqual(start, -1, "layout Coming Soon route list should be present");
 const end = app.indexOf("];", start);
 assert.notEqual(end, -1, "layout Coming Soon route list should be closed");
 const comingSoon = app.slice(start, end);
 assert.equal(comingSoon.includes('"/my-blog"'), false);
});

test("home page derives member actions from the shared Supabase auth session", () => {
 const home = file("../src/pages/Home.jsx");
 assert.match(home, /useAuthSession/);
 assert.match(home, /authStatus === "signed-in"/);
 assert.match(home, /authStatus === "loading"/);
 assert.match(home, /authStatus === "signed-out"/);
 assert.doesNotMatch(home, /const isAuthenticated = false/);
});
