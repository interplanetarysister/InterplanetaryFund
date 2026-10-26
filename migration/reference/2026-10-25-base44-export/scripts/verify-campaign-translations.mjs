import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const campaignPage = read("src/pages/CampaignDetail.jsx");
const picker = read("src/components/campaigns/CampaignTranslation.jsx");
const help = read("src/lib/workflowHelpGuides.js");
const schema = JSON.parse(read("base44/entities/CampaignTranslation.jsonc"));
const deleteFn = read("base44/functions/deleteCampaign/entry.ts");
const endpoint = read("base44/functions/translateCampaign/entry.ts");

assert.match(campaignPage, /<CampaignTranslation campaign=\{campaign\}/);
assert.match(campaignPage, /displayed\.title/);
assert.match(campaignPage, /displayed\.summary/);
assert.match(campaignPage, /displayed\.story/);
assert.match(picker, /Original language/);
assert.match(picker, /Publish .* translation/);
assert.match(help, /slug: "translate-a-campaign"/);
assert.match(deleteFn, /CampaignTranslation\.deleteMany/);
assert.equal(schema.properties.language_code.enum.length, 10);
assert.equal((picker.match(/\["[A-Za-z-]+",/g) || []).length, 10);
assert.equal(schema.rls.read.user_condition.role, "admin");
for (const operation of ["create", "update", "delete"]) {
  assert.equal(schema.rls[operation].user_condition.role, "admin");
}

const campaigns = new Map([["c1", {
  id: "c1", created_by_id: "owner", status: "active",
  title: "Save the library", summary: "Books for children",
  story: "Please help with 20 books by January 2027.",
  goal_amount: 500,
}]]);
const translations = [];
let loggedIn = null;
let llmCalls = 0;
const serviceEntities = {
  Campaign: { get: async id => campaigns.get(id) || null },
  CampaignTranslation: {
    filter: async ({ campaign_id }) => translations.filter(t => t.campaign_id === campaign_id),
    create: async row => {
      const entry = { ...row, id: "translation-" + (translations.length + 1) };
      translations.push(entry);
      return entry;
    },
    update: async (id, attrs) => {
      const entry = translations.find(t => t.id === id);
      assert.ok(entry);
      Object.assign(entry, attrs);
      return entry;
    },
  },
};
const client = {
  asServiceRole: { entities: serviceEntities },
  auth: { me: async () => {
    if (!loggedIn) throw new Error("Not authenticated");
    return loggedIn;
  } },
  integrations: { Core: { InvokeLLM: async () => {
    llmCalls++;
    return { title: "Salvar la biblioteca", summary: "Libros para niños",
      story: "Por favor, ayude con 20 libros antes de enero de 2027." };
  } } },
};
const translatedSource = endpoint
  .replace(/^import\s+.*\s+from\s+.*;\s*$/gm, "")
  .replace("export default async function(req)", "async function handler(req)");
const handler = new Function("createClientFromRequest", "Response", "crypto",
  translatedSource + "\nreturn handler;")(() => client, Response, webcrypto);

async function request(action, language_code = "es", campaign_id = "c1") {
  const response = await handler(new Request("https://ifund.test/translate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, language_code, campaign_id }),
  }));
  return { status: response.status, data: await response.json() };
}

let res = await request("list");
assert.equal(res.status, 200);
assert.deepEqual(res.data.languages, []);
assert.equal((await request("generate")).status, 403, "Guests cannot spend AI credits");
assert.equal((await request("publish")).status, 403);
assert.equal((await request("read")).status, 404, "Guests cannot see drafts");

loggedIn = { id: "owner", role: "user" };
res = await request("generate");
assert.equal(res.status, 200);
assert.equal(res.data.translation.status, "draft");
assert.equal(llmCalls, 1);
assert.equal((await request("generate")).data.cached, true);
assert.equal(llmCalls, 1, "Same-source language should reuse cached draft");

loggedIn = null;
assert.equal((await request("read")).status, 404);
assert.deepEqual((await request("list")).data.languages, []);
loggedIn = { id: "owner", role: "user" };
res = await request("publish");
assert.equal(res.status, 200);
assert.equal(res.data.translation.status, "published");

loggedIn = null;
res = await request("read");
assert.equal(res.status, 200);
assert.equal(res.data.translation.title, "Salvar la biblioteca");
assert.equal((await request("list")).data.languages[0].language_code, "es");
assert.equal((await request("generate", "zz")).status, 400);
assert.equal((await request("read", "es", "unknown")).status, 404);

campaigns.get("c1").story = "The goal is now 30 books.";
assert.equal((await request("read")).status, 404, "Stale translations must not be shown");
assert.deepEqual((await request("list")).data.languages, []);
loggedIn = { id: "owner", role: "user" };
assert.equal((await request("generate")).status, 502, "Changed numbers must fail translation validation");
assert.equal(translations.length, 1, "Rejected translations must never be stored");
loggedIn = { id: "other", role: "user" };
assert.equal((await request("generate")).status, 403, "Another user cannot generate");

console.log("PASS: ten languages, guest safety, owner-only generation, reviewed publish, caching, stale-text invalidation, and deletion contract.");
