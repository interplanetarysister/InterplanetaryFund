import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { financeDemoRows, demoFinanceStats } from "../src/lib/hackathonFinanceDemo.mjs";
const collection = JSON.parse(readFileSync(new URL("../public/docs/postman/ifund-paypal-sandbox-readonly.postman_collection.json", import.meta.url), "utf8"));
test("Postman collection uses v2.1 and sandbox-only GET requests", () => {
  assert.equal(collection.info.schema, "https://schema.getpostman.com/json/collection/v2.1.0/collection.json");
  assert.equal(collection.item.length, 4);
  assert.equal(collection.variable[0].value, "https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev");
  for (const i of collection.item) {
    assert.equal(i.request.method, "GET");
    assert.ok(i.request.url.startsWith("{{sandbox_origin}}/"));
    assert.equal(i.request.body, undefined);
    assert.ok(i.event[0].script.exec.some(line => line.includes("pm.test")));
  }
  assert.ok(!collection.item.some(i => /\/capture$|\/webhook$/.test(i.request.url)));
});
test("AG Grid showcase data is deterministic and explicitly fictional", () => {
  assert.equal(financeDemoRows.length, 10);
  assert.equal(demoFinanceStats().examples, 10);
  assert.ok(financeDemoRows.every(row => row.id.startsWith("EXAMPLE-") && row.status.startsWith("Sample ")));
  assert.ok(financeDemoRows.every(row => Number.isSafeInteger(row.amountCents) && row.amountCents >= 0));
  assert.ok(financeDemoRows.some(row => row.status === "Sample refunded"));
});
