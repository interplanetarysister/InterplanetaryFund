import test from "node:test";
import assert from "node:assert/strict";
import { routePublicHelpIndex } from "../../../worker/studioRoutes.js";
import { parsePublicHelpIndex } from "../src/lib/studioHelpContent.mjs";

const request = method => new Request("https://interplanetaryfund.com/api/public/help/index", { method });
const env = {
  IFUND_STUDIO_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
};
const records = [{ slug: "help-create-a-campaign", status: "published",
  content: { blocks: [{ id: "help-main", type: "text",
    body: "Build your own story, check details, and publish only when ready." }] },
  updated_by: "private-user", credentials: "hidden" }];
const mockFetch = (rows, check) => async (url, init) => {
  check?.(url, init);
  return new Response(JSON.stringify(rows), {
    status: 200, headers: { "content-type": "application/json" },
  });
};

test("published Help index reads only published Studio content and strips secret fields", async () => {
  const result = await routePublicHelpIndex(request("GET"), env, mockFetch(records, (url, init) => {
    const query = new URL(url);
    assert.equal(query.searchParams.get("status"), "eq.published");
    assert.equal(query.searchParams.get("slug"), "like.help-*");
    assert.equal(query.searchParams.get("select"), "slug,status,content");
    assert.equal(init.method, "GET");
    assert.ok(!init.headers.Authorization, "public help lookup must not forward account credentials");
  }));
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.deepEqual(payload, { articles: [{
    slug: "create-a-campaign", answer: "Build your own story, check details, and publish only when ready.",
  }] });
  assert.equal(JSON.stringify(payload).includes("private-user"), false);
  assert.equal(JSON.stringify(payload).includes("hidden"), false);
  const safe = parsePublicHelpIndex(payload, ["create-a-campaign", "campaign-donations"]);
  assert.equal(safe["create-a-campaign"], payload.articles[0].answer);
});

test("Help index refuses malformed backend rows and never serves private drafts", async () => {
  for (const bad of [
    [{ ...records[0], status: "draft" }],
    [{ ...records[0], slug: "private-data" }],
    [records[0], records[0]],
    new Array(51).fill(records[0]),
  ]) {
    const response = await routePublicHelpIndex(request("GET"), env, mockFetch(bad));
    assert.equal(response.status, 503);
  }
  const disabled = await routePublicHelpIndex(request("GET"), { ...env, IFUND_STUDIO_ENABLED: "disabled" });
  assert.equal(disabled.status, 503);
  const refused = await routePublicHelpIndex(request("POST"), env);
  assert.equal(refused.status, 405);
});

test("Help index parser excludes unknown slugs and malformed published answers", () => {
  for (const payload of [
    { articles: [{ slug: "unknown", answer: "This is not a registered question and must fail." }] },
    { articles: [{ slug: "create-a-campaign", answer: "short" }] },
    { articles: [{ slug: "create-a-campaign", answer: "x".repeat(4001) }] },
    { articles: [{ slug: "create-a-campaign", answer: "Long enough to be valid." },
      { slug: "create-a-campaign", answer: "Duplicate answers cannot silently overwrite." }] },
  ])
    assert.throws(() => parsePublicHelpIndex(payload, ["create-a-campaign"]));
  assert.deepEqual(parsePublicHelpIndex({ articles: [] }, ["create-a-campaign"]), {});
});
