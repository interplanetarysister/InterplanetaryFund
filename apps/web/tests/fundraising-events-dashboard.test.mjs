import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8");

test("authenticated dashboard presents event formats without implying live event checkout", () => {
  assert.match(dashboard, /Fundraising events/);
  assert.match(dashboard, /Benefit dinners & gatherings/);
  assert.match(dashboard, /Art auctions & experiences/);
  assert.match(dashboard, /Community benefit events/);
  assert.match(dashboard, /Explore campaigns/);
  assert.match(dashboard, /Create a campaign for your event/);
  assert.match(dashboard, /ticketing, auction bidding and in-person purchases are not yet enabled/);
});

test("event dashboard actions use existing IFund account routes", () => {
  assert.match(dashboard, /to="\/discover"/);
  assert.match(dashboard, /to="\/create"/);
  assert.match(dashboard, /to="\/finances#giving-receipts"/);
  assert.match(dashboard, /to="\/connections"/);
});
