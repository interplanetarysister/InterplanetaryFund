import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeReturnTo, loginPathFor } from "../src/lib/authReturnTo.js";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("legitimate deep links with search and fragment survive sign-in", () => {
  const target = "/edit/campaign-123?tab=story&view=preview#media";
  assert.equal(safeReturnTo(target), target);
  const login = loginPathFor({ pathname: "/edit/campaign-123", search: "?tab=story&view=preview", hash: "#media" });
  assert.equal(new URLSearchParams(login.split("?")[1]).get("returnTo"), target);
  assert.equal(safeReturnTo("/create"), "/create");
  assert.equal(safeReturnTo(null), "/mine");
});

test("external and ambiguous redirect paths fail closed", () => {
  for (const value of [
    "https://evil.example", "http://evil.example", "//evil.example",
    "/\\evil.example", "/%5Cevil.example", "/%2F%2Fevil.example",
    "javascript:alert(1)", "data:text/html,foo", "", null,
    "/login", "/register", "/reset-password", "/forgot-password",
    "/login?returnTo=%2Fcreate", "/\nexternal", "/%ZZ",
    "/".repeat(2050),
  ]) assert.equal(safeReturnTo(value), "/mine", String(value));
});

test("bootstrap and token override query keys are stripped", () => {
  const value = safeReturnTo("/create?tab=story&app_base_url=https%3A%2F%2Fevil.example&access_token=secret&refresh_token=secret2&app_id=x&clear_access_token=1&functions_version=bad&from_url=bad#draft");
  assert.match(value, /^\/create\?tab=story#draft$/);
  assert.doesNotMatch(value, /secret|app_base_url|app_id|functions_version/);
});

test("private routes do not bypass sign-in and the original destination is preserved", () => {
  const app = source("src/App.jsx");
  assert.match(app, /loginPathFor\(location\)/);
  assert.match(app, /<Link to=\{loginPath\}>Sign in/);
  for (const path of ["/create", "/edit/:id", "/mine", "/connections", "/my-blog"]) {
    assert.ok(app.includes('path="' + path + '"'));
  }
  assert.match(app, /path="\/connections" element=\{user \?/);
  assert.match(app, /path="\/my-blog" element=\{user \?/);
});

test("email sign-in uses the current domain callback and supports link or code templates", () => {
  const auth = source("src/pages/Auth.jsx");
  assert.match(auth, /safeReturnTo\(params\.get\("returnTo"\)\)/);
  assert.match(auth, /emailRedirectTo:[\s\S]*window\.location\.origin[\s\S]*encodeURIComponent\(returnTo\)/);
  assert.match(auth, /sign-in link or one-time code/);
  assert.match(auth, /navigate\(returnTo, \{ replace: true \}\)/);
  assert.match(auth, /db\.auth\.signInWithPassword/);
  assert.match(auth, /type="password"/);
  assert.match(auth, /autoComplete="current-password"/);
  assert.match(auth, /switchAuthMode\("password"\)/);
  assert.doesNotMatch(auth, /db\.auth\.signUp/);
  assert.match(auth, /if \(signOutError\) throw signOutError/);
  assert.match(auth, /We could not complete sign-out/);
  assert.doesNotMatch(auth, /window\.location\.assign\(params\.get\(/);
});

test("OAuth buttons are hidden unless a provider is explicitly enabled for the deployment", () => {
  const auth = source("src/pages/Auth.jsx");
  assert.match(auth, /VITE_SUPABASE_OAUTH_PROVIDERS/);
  assert.match(auth, /Object\.hasOwn\(PROVIDER_LABELS, provider\)/);
  assert.match(auth, /SIGN_IN_PROVIDERS\.map/);
  assert.doesNotMatch(auth, /id:.*instagram/);
});
