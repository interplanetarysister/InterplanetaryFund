import test from "node:test";
import assert from "node:assert/strict";
import { campaignDetailOutcome } from "../src/lib/campaignDetailState.js";

test("returns the campaign for a successful lookup", () => {
  const campaign = { id: "campaign-1", title: "Community garden" };
  assert.deepEqual(campaignDetailOutcome({ data: campaign, error: null }), {
    status: "ready",
    campaign,
  });
});

test("treats PostgREST single-row not-found as a terminal not-found state", () => {
  assert.deepEqual(
    campaignDetailOutcome({
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
    }),
    { status: "not_found" },
  );
});

test("treats an empty successful response as not found", () => {
  assert.deepEqual(campaignDetailOutcome({ data: null, error: null }), {
    status: "not_found",
  });
});

test("returns a generic retryable error without exposing backend details", () => {
  const result = campaignDetailOutcome({
    data: null,
    error: { code: "42501", message: "permission denied for table ifund_campaigns" },
  });
  assert.deepEqual(result, {
    status: "error",
    message: "We couldn't load this campaign. Please try again.",
  });
  assert.ok(!JSON.stringify(result).includes("42501"));
  assert.ok(!JSON.stringify(result).includes("permission denied"));
});

test("treats a missing result as not found instead of leaving the page loading", () => {
  assert.deepEqual(campaignDetailOutcome(), { status: "not_found" });
});
