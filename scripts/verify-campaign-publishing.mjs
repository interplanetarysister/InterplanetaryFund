// Browser regression checks against a running apps/web dev server. Supabase
// requests are intercepted; this verifies UI/transport, not live RLS or Auth.
// Set IFUND_PLAYWRIGHT_MODULE to an installed Playwright index.mjs if it is not
// in the normal module search path. No browser/package download is performed.
import assert from "node:assert/strict";
import { serviceGateway } from "../worker/services/gateway.js";
const { chromium } = await import(process.env.IFUND_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.IFUND_TEST_ORIGIN || "http://127.0.0.1:4173";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Use a local development server for intercepted browser checks.");
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const storageKey = "sb-ssibsfmtodgximseeqsv-auth-token";
const user = { id: OWNER, email: "browser-test@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z", aud: "authenticated", role: "authenticated" };
const testToken = id => [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), Buffer.from("local-test-only").toString("base64url")].join(".");
const session = { access_token: testToken(OWNER), refresh_token: "local-test-only", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user };
const fixture = () => ({ id: ID, owner_id: OWNER, title: "Synthetic community garden", summary: "A garden for our neighborhood.", story: "We will purchase tools and seeds for the shared garden.", category: "community", goal_amount: 250, cover_image_url: "", status: "draft", created_at: "2026-11-01T00:00:00Z" });
const browser = await chromium.launch({ executablePath: process.env.IFUND_CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const results = [];
async function scenario(name, test, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const state = { authenticated: true, identity: OWNER, accepted: true, active: true, rows: [], writes: [], errors: [], writingLevel: 1, writingCalls: [], nativeWritingCalls: [], ...options };
  await context.addInitScript(({ storageKey, session, signedIn }) => { if (signedIn) localStorage.setItem(storageKey, JSON.stringify(session)); }, { storageKey, session, signedIn: state.authenticated });
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(origin).origin && url.pathname === "/api/services/story_agent/campaign-preview") {
      const raw = request.postDataJSON();
      state.writingCalls.push(raw);
      const response = await serviceGateway(new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.postData() }), {
        IFUND_STORY_AGENT: { fetch: async forwarded => {
          if (!state.authenticated || !state.active) return Response.json({ error: "Access denied" }, { status: 403 });
          if (new URL(forwarded.url).pathname.endsWith("/subscription")) return Response.json({ active: state.writingLevel > 0, level: state.writingLevel });
          if (!state.accepted) return Response.json({ error: "Member agreement required" }, { status: 403 });
          const body = await forwarded.json();
          state.nativeWritingCalls.push(body);
          if (state.queueFirst && state.nativeWritingCalls.length === 1) return Response.json({ state: "queued", request_id: body.request_id }, { status: 202 });
          if (state.writingFailure) return Response.json({ error: "Synthetic failure" }, { status: 503 });
          if (state.writingDelay) await new Promise(resolve => setTimeout(resolve, state.writingDelay));
          const payload = body.section ? { section: "A reviewed replacement paragraph.\n\nThe second paragraph keeps the original facts." }
            : { titles: ["Garden for everyone", "Tools for our garden", "Grow our community", "A shared growing space", "Help our neighborhood garden"], summaries: ["A factual community garden summary.", "A second truthful summary."], story: "We are creating a community garden.\n\nFunds would buy the tools and seeds described by the organizer.", image_prompt: "A symbolic neighborhood garden." };
          return Response.json({ draft: { id: "44444444-4444-4444-8444-444444444444", payload } }, { status: 201 });
        } },
      });
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    }
    if (url.origin === new URL(origin).origin) return route.continue();
    if (url.hostname !== "ssibsfmtodgximseeqsv.supabase.co") return route.abort();
    const method = request.method();
    const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data), headers: { "access-control-allow-origin": "*" } });
    const one = data => request.headers().accept?.includes("vnd.pgrst.object") ? data : data ? [data] : [];
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.pathname === "/auth/v1/user") return json(state.authenticated ? { ...user, id: state.identity } : { message: "Not signed in" }, state.authenticated ? 200 : 401);
    if (url.pathname === "/rest/v1/ifund_profiles") return json(one({ id: state.identity, account_status: state.active ? "active" : "suspended", account_deletion_pending: false }));
    if (url.pathname === "/rest/v1/ifund_legal_acceptances") {
      if (method === "POST") { state.accepted = true; return json(null, 201); }
      return json(one(state.accepted ? { owner_id: state.identity, terms_version: "2026-10-13-v3", explicit_consent: true } : null));
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
    assert.equal(await page.getByLabel("Fundraising goal (USD)").inputValue(), "");
    await page.getByRole("button", { name: "Save private draft", exact: true }).click();
    await page.getByText("Private draft saved.", { exact: false }).waitFor();
    await complete(page);
    assert.equal(await page.locator("select option").count(), 11);
    assert.equal(await page.getByLabel("Short description").getAttribute("maxlength"), "600");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await doublePublish(page);
    await page.getByRole("heading", { name: "Synthetic community garden", exact: true }).waitFor();
    assert.deepEqual(state.writes.map(w => [w.method, w.payload.status]), [["POST", "draft"], ["PATCH", "draft"], ["PATCH", "active"]]);
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
    await page.getByLabel("What is your fundraiser about?").fill("Guest facts for a neighborhood garden survive sign-in.");
    await page.getByRole("radio", { name: "My community", exact: true }).check();
    await page.getByRole("region", { name: "Save or publish campaign" }).getByRole("link", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/login?returnTo=%2Fcreate");
    assert.equal(state.writes.length, 0);
    await page.evaluate(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), { storageKey, session });
    state.authenticated = true;
    await page.goto(origin + "/create");
    assert.equal(await page.getByLabel("Campaign title", { exact: true }).inputValue(), "Guest draft survives");
    assert.equal(await page.getByLabel("What is your fundraiser about?").inputValue(), "Guest facts for a neighborhood garden survive sign-in.");
    assert.equal(await page.getByRole("radio", { name: "My community", exact: true }).isChecked(), true);
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
  await scenario("Account switches and sign-out clear unsaved member text and assistant context", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByRole("button", { name: "Save private draft", exact: true }).waitFor();
    await page.getByLabel("Campaign title", { exact: true }).fill("Private owner A text");
    await page.getByLabel("What is your fundraiser about?").fill("Private owner A assistant context.");
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("ifund-guest-campaign-v1")).owner_id), OWNER);
    state.identity = OTHER;
    await page.evaluate(async token => {
      const { authClient } = await import("/src/api/auth.js");
      const { error } = await authClient().auth.setSession({ access_token: token, refresh_token: "local-test-only" });
      if (error) throw error;
    }, testToken(OTHER));
    await page.waitForFunction(() => document.querySelector("#campaign-editor input")?.value === "");
    assert.equal(await page.getByLabel("What is your fundraiser about?").inputValue(), "");
    assert.equal(await page.getByText("Private owner A text", { exact: true }).count(), 0);
    await page.getByLabel("Campaign title", { exact: true }).fill("Private owner B text");
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("ifund-guest-campaign-v1")).owner_id), OTHER);
    state.authenticated = false;
    await page.evaluate(async () => {
      const { authClient } = await import("/src/api/auth.js");
      const { error } = await authClient().auth.signOut({ scope: "local" });
      if (error) throw error;
    });
    await page.waitForFunction(() => document.querySelector("#campaign-editor input")?.value === "");
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("ifund-guest-campaign-v1")).owner_id), null);
    assert.equal(state.writes.length, 0);
  });
  await scenario("The creator requests writing without choosing a model and publishes only applied content", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByRole("button", { name: "Save private draft", exact: true }).waitFor();
    await page.getByLabel("What is your fundraiser about?").fill("A neighborhood garden needs tools and seeds for the community.");
    await page.getByLabel("Who benefits? (optional)").fill("Our neighbors");
    await page.getByLabel("What is needed? (optional)").fill("Tools and seeds");
    await page.getByLabel("Fundraising goal (USD)").fill("250");
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.getByRole("region", { name: "Campaign ideas", exact: true }).waitFor();
    assert.equal(state.nativeWritingCalls.length, 1);
    assert.equal(state.writes.length, 0);
    assert.equal(await page.getByLabel("Campaign title", { exact: true }).inputValue(), "");
    await page.getByRole("button", { name: "Use title", exact: true }).first().click();
    await page.getByRole("button", { name: "Use description", exact: true }).first().click();
    await page.getByRole("button", { name: "Use story", exact: true }).click();
    await doublePublish(page);
    assert.equal(state.writes.length, 1);
    assert.equal(state.writes[0].payload.title, "Garden for everyone");
    assert.equal(state.writes[0].payload.status, "active");
  });
  await scenario("The free basic outline is labeled accurately and never calls native execution", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByLabel("What is your fundraiser about?").fill("A local animal rescue needs equipment for the animals.");
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).click();
    await page.getByText("A basic outline is ready", { exact: false }).waitFor();
    assert.equal(state.nativeWritingCalls.length, 0);
    assert.equal(await page.getByRole("button", { name: "Use title", exact: true }).count(), 5);
    assert.equal(await page.getByRole("button", { name: "Regenerate this section", exact: true }).first().isEnabled(), false);
  }, { writingLevel: 0 });
  await scenario("Queued writing resumes the same request and does not invent completed suggestions", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByLabel("What is your fundraiser about?").fill("A neighborhood garden needs tools and seeds for the community.");
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).click();
    await page.getByRole("link", { name: "View saved writing requests", exact: true }).waitFor();
    assert.equal(await page.getByRole("region", { name: "Campaign ideas", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).click();
    await page.getByRole("region", { name: "Campaign ideas", exact: true }).waitFor();
    assert.equal(state.writingCalls.length, 2);
    assert.equal(state.writingCalls[0].request_id, state.writingCalls[1].request_id);
  }, { queueFirst: true });
  await scenario("A rewrite keeps the full replacement and all other story sections", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByLabel("What is your fundraiser about?").fill("A neighborhood garden needs tools and seeds for the community.");
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).click();
    await page.getByRole("region", { name: "Campaign ideas", exact: true }).waitFor();
    await page.getByRole("button", { name: "Regenerate this section", exact: true }).first().click();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByRole("button", { name: "Use edited story sections", exact: true }).click();
    const story = await page.getByLabel("Your story").inputValue();
    assert.ok(story.includes("The second paragraph keeps the original facts."));
    assert.ok(story.includes("Funds would buy the tools and seeds described by the organizer."));
    assert.equal(state.nativeWritingCalls.length, 2);
  });
  await scenario("A writing failure retains previously completed suggestions and the owner's form text", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByLabel("What is your fundraiser about?").fill("A neighborhood garden needs tools and seeds for the community.");
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).click();
    await page.getByRole("region", { name: "Campaign ideas", exact: true }).waitFor();
    await page.getByRole("button", { name: "Use story", exact: true }).click();
    const original = await page.getByLabel("Your story").inputValue();
    state.writingFailure = true;
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "temporarily unavailable" }).waitFor();
    assert.equal(await page.getByLabel("Your story").inputValue(), original);
    assert.equal(await page.getByRole("region", { name: "Campaign ideas", exact: true }).count(), 1);
    assert.equal(state.writes.length, 0);
  });
  await scenario("A response arriving after an account switch cannot populate the next owner's editor", async (page, state) => {
    await page.goto(origin + "/create");
    await page.getByRole("button", { name: "Save private draft", exact: true }).waitFor();
    await page.getByLabel("What is your fundraiser about?").fill("Private owner A facts for a neighborhood garden.");
    const outgoing = page.waitForRequest(request => new URL(request.url()).pathname.endsWith("/campaign-preview"));
    const finished = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/campaign-preview"));
    await page.getByRole("button", { name: "Generate campaign ideas", exact: true }).click();
    await outgoing;
    state.identity = OTHER;
    await page.evaluate(async token => {
      const { authClient } = await import("/src/api/auth.js");
      const { error } = await authClient().auth.setSession({ access_token: token, refresh_token: "local-test-only" });
      if (error) throw error;
    }, testToken(OTHER));
    const response = await finished;
    await response.finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.getByLabel("What is your fundraiser about?").inputValue(), "");
    assert.equal(await page.getByRole("region", { name: "Campaign ideas", exact: true }).count(), 0);
    assert.equal(state.writes.length, 0);
  }, { writingDelay: 500 });
} finally { await browser.close(); }
console.log(JSON.stringify({ transport: "intercepted Supabase; local app; no live writes", results }, null, 2));
if (results.some(result => result.status !== "PASS")) process.exitCode = 1;
