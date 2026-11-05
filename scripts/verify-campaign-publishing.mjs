// Browser regression checks against a running apps/web dev server. Supabase
// requests are intercepted; this verifies UI/transport, not live RLS or Auth.
// Set IFUND_PLAYWRIGHT_MODULE to an installed Playwright index.mjs if it is not
// in the normal module search path. No browser/package download is performed.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.IFUND_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.IFUND_TEST_ORIGIN || "http://127.0.0.1:4173";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Use a local development server for intercepted browser checks.");
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const storageKey = "sb-ssibsfmtodgximseeqsv-auth-token";
const user = { id: OWNER, email: "browser-test@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", aud: "authenticated", role: "authenticated" };
const session = { access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEifQ.test", refresh_token: "local-test-only", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user };
const fixture = () => ({ id: ID, owner_id: OWNER, title: "Synthetic community garden", summary: "A garden for our neighborhood.", story: "We will purchase tools and seeds for the shared garden.", category: "community", goal_amount: 250, cover_image_url: "", status: "draft", created_at: "2026-11-01T00:00:00Z" });
const browser = await chromium.launch({ executablePath: process.env.IFUND_CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const results = [];
async function scenario(name, test, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const state = { authenticated: true, accepted: true, active: true, rows: [], writes: [], errors: [], ...options };
  await context.addInitScript(({ storageKey, session, signedIn }) => { if (signedIn) localStorage.setItem(storageKey, JSON.stringify(session)); }, { storageKey, session, signedIn: state.authenticated });
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(origin).origin) return route.continue();
    if (url.hostname !== "ssibsfmtodgximseeqsv.supabase.co") return route.abort();
    const method = request.method();
    const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data), headers: { "access-control-allow-origin": "*" } });
    const one = data => request.headers().accept?.includes("vnd.pgrst.object") ? data : data ? [data] : [];
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.pathname === "/auth/v1/user") return json(state.authenticated ? user : { message: "Not signed in" }, state.authenticated ? 200 : 401);
    if (url.pathname === "/rest/v1/ifund_profiles") return json(one({ id: OWNER, account_status: state.active ? "active" : "suspended", account_deletion_pending: false }));
    if (url.pathname === "/rest/v1/ifund_legal_acceptances") {
      if (method === "POST") { state.accepted = true; return json(null, 201); }
      return json(one(state.accepted ? { owner_id: OWNER, terms_version: "2026-10-13-v3", explicit_consent: true } : null));
    }
    if (url.pathname === "/rest/v1/ifund_campaigns") {
      const matching = () => state.rows.filter(row => ["id", "owner_id", "status", "category"].every(key => {
        const filter = url.searchParams.get(key);
        return !filter || !filter.startsWith("eq.") || row[key] === filter.slice(3);
      }));
      if (method === "GET") {
        const rows = matching();
        return json(request.headers().accept?.includes("vnd.pgrst.object") ? rows[0] || null : rows);
      }
      state.writes.push({ method, payload: request.postDataJSON() });
      if (state.failWrite) return json({ code: "TEST_ERROR", message: "Synthetic failure" }, 400);
      await new Promise(resolve => setTimeout(resolve, 80));
      if (method === "POST") {
        const row = { ...fixture(), ...request.postDataJSON() };
        state.rows.push(row);
        return json(one(row), 201);
      }
      if (method === "PATCH") {
        const row = matching()[0];
        if (row) Object.assign(row, request.postDataJSON());
        return json(one(row || null));
      }
    }
    return json([]);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(10000);
  page.on("pageerror", error => state.errors.push(error.message));
  try {
    await test(page, state);
    assert.deepEqual(state.errors, [], "No uncaught browser errors");
    results.push({ name, status: "PASS" });
    console.log("PASS: " + name);
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
    console.log("FAIL: " + name + " — " + error.message);
  } finally { await context.close(); }
}
async function complete(page) {
  await page.getByLabel("Campaign title", { exact: true }).fill("Synthetic community garden");
  await page.getByLabel("Short description").fill("A garden for our neighborhood.");
  await page.getByLabel("Your story").fill("We will purchase tools and seeds for the shared garden.");
  await page.getByLabel("Fundraising goal (USD)", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Publish campaign", exact: true }).waitFor();
}
async function doublePublish(page) {
  await page.getByRole("button", { name: "Publish campaign", exact: true }).evaluate(button => { button.click(); button.click(); });
  await page.waitForURL(`**/campaign/${ID}`);
}
try {
  await scenario("Enter saves a private draft; explicit publish updates the same campaign once", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByRole("button", { name: "Save private draft", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Publish campaign", exact: true }).isEnabled(), false);
    await page.getByLabel("Campaign title", { exact: true }).fill("Synthetic community garden");
    await page.getByLabel("Campaign title", { exact: true }).press("Enter");
    await page.waitForURL(`**/create?draft=${ID}`);
    await page.getByText("Private draft saved.", { exact: false }).waitFor();
    assert.equal(state.rows[0].status, "draft");
    await complete(page);
    assert.equal(await page.locator("select option").count(), 11);
    assert.equal(await page.getByLabel("Short description").getAttribute("maxlength"), "600");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await doublePublish(page);
    await page.getByRole("heading", { name: "Synthetic community garden", exact: true }).waitFor();
    assert.deepEqual(state.writes.map(w => [w.method, w.payload.status]), [["POST", "draft"], ["PATCH", "active"]]);
    assert.equal(state.rows.length, 1);
    await page.reload();
    await page.getByRole("heading", { name: "Synthetic community garden", exact: true }).waitFor();
    await page.goto(origin + "/discover");
    await page.getByRole("link", { name: /Synthetic community garden/ }).first().waitFor();
  });
  await scenario("A complete new campaign can publish directly without duplicate inserts", async (page, state) => {
    await page.goto(origin + "/create");
    await complete(page);
    await doublePublish(page);
    assert.equal(state.writes.length, 1);
    assert.equal(state.rows[0].status, "active");
  });
  await scenario("A failed publish preserves the owner draft and current text", async (page, state) => {
    await page.goto(origin + `/create?draft=${ID}`);
    await page.getByRole("button", { name: "Publish campaign", exact: true }).waitFor();
    await page.getByLabel("Your story").fill("Reviewed text kept after the synthetic write failure.");
    await page.getByRole("button", { name: "Publish campaign", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "not saved" }).waitFor();
    assert.equal(await page.getByLabel("Your story").inputValue(), "Reviewed text kept after the synthetic write failure.");
    assert.equal(state.rows[0].status, "draft");
    assert.ok(page.url().includes("/create?draft="));
  }, { rows: [fixture()], failWrite: true });
  await scenario("A draft changed elsewhere is blocked before any write", async (page, state) => {
    await page.goto(origin + `/create?draft=${ID}`);
    await page.getByText("Private draft saved.", { exact: false }).waitFor();
    state.rows[0].status = "paused";
    await page.getByRole("button", { name: "Publish campaign", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "changed in another session" }).first().waitFor();
    assert.equal(state.writes.length, 0);
    assert.equal(state.rows[0].status, "paused");
  }, { rows: [fixture()] });
  await scenario("Guest text survives sign-in routing; returning never automatically publishes", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByLabel("Campaign title", { exact: true }).fill("Guest draft survives");
    await page.getByRole("region", { name: "Save or publish campaign" }).getByRole("link", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/login?returnTo=%2Fcreate");
    assert.equal(state.writes.length, 0);
    await page.evaluate(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), { storageKey, session });
    state.authenticated = true;
    await page.goto(origin + "/create");
    assert.equal(await page.getByLabel("Campaign title", { exact: true }).inputValue(), "Guest draft survives");
    assert.equal(state.writes.length, 0);
  }, { authenticated: false });
  await scenario("Member agreement is separate from the editor and never triggers publication", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByRole("heading", { name: "Review the member agreement" }).waitFor();
    assert.equal(await page.locator("form form").count(), 0);
    await page.getByLabel("Campaign title", { exact: true }).fill("Agreement required");
    await page.locator("#campaign-editor").evaluate(form => form.requestSubmit());
    await page.getByRole("alert").filter({ hasText: "member agreement" }).waitFor();
    assert.equal(state.writes.length, 0);
    assert.equal(await page.getByRole("button", { name: "Publish campaign", exact: true }).count(), 0);
  }, { accepted: false });
  await scenario("Another owner's draft is inaccessible", async page => {
    await page.goto(origin + `/create?draft=${ID}`);
    await page.getByRole("alert").filter({ hasText: "not found for your account" }).waitFor();
    assert.equal(await page.getByLabel("Campaign title", { exact: true }).isEnabled(), false);
    assert.equal(await page.getByText("Private draft saved.", { exact: false }).count(), 0);
  }, { rows: [{ ...fixture(), owner_id: OTHER }] });
  await scenario("Suspended accounts cannot load the saved editor", async page => {
    await page.goto(origin + `/create?draft=${ID}`);
    await page.getByRole("heading", { name: "Account verification unavailable" }).waitFor();
    assert.equal(await page.getByLabel("Campaign title", { exact: true }).count(), 0);
  }, { rows: [fixture()], active: false });
} finally { await browser.close(); }
console.log(JSON.stringify({ transport: "intercepted Supabase; local app; no live writes", results }, null, 2));
if (results.some(result => result.status !== "PASS")) process.exitCode = 1;
