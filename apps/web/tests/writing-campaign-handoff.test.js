import test from "node:test";
import assert from "node:assert/strict";
import {
  rememberWritingHandoff,
  readWritingHandoff,
  forgetWritingHandoff,
  WritingHandoffError,
} from "../src/lib/writingCampaignHandoff.js";

const OWNER = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222",
  DRAFT = "33333333-3333-4333-8333-333333333333",
  REF = "44444444-4444-4444-8444-444444444444",
  CAMPAIGN = "55555555-5555-4555-8555-555555555555";
const storage = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
};
const draft = () => ({
  id: DRAFT,
  status: "draft",
  source_system: "ifund_story_v1",
  campaign_id: null,
  payload: {
    titles: ["First title", "Selected title"],
    summaries: ["First summary", "Selected summary"],
    story: "The complete first paragraph.\n\nThe complete second paragraph.",
    image_prompt: "Not an actual image",
    secret: "never copy extra metadata",
  },
});
const input = () => ({
  ownerId: OWNER,
  draft: draft(),
  selection: { title_index: 1, summary_index: 1 },
});

test("selected writing moves into a tab-only review record without overwriting an existing campaign", () => {
  const s = storage();
  s.setItem("ifund-guest-campaign-v1", "existing private campaign");
  const link = rememberWritingHandoff(s, input(), { id: REF, now: 1000 });
  assert.equal(link.target, "/create?writing=" + REF);
  const record = readWritingHandoff(s, { ownerId: OWNER, id: REF, now: 1001 });
  assert.deepEqual(record.copy, {
    title: "Selected title",
    summary: "Selected summary",
    story: draft().payload.story,
  });
  assert.equal(
    s.getItem("ifund-guest-campaign-v1"),
    "existing private campaign",
  );
  assert.ok(!JSON.stringify(record).includes("secret"));
  assert.ok(!JSON.stringify(record).includes("image_prompt"));
});

test("only the original account, destination and live handoff reference can restore private writing", () => {
  const s = storage();
  rememberWritingHandoff(
    s,
    { ...input(), campaignId: CAMPAIGN },
    { id: REF, now: 1000 },
  );
  for (const changes of [
    { ownerId: OTHER },
    { ownerId: null },
    { id: DRAFT },
    { campaignId: null },
    { now: 3601001 },
    { now: 999 },
  ])
    assert.equal(
      readWritingHandoff(s, {
        ownerId: OWNER,
        id: REF,
        campaignId: CAMPAIGN,
        now: 1001,
        ...changes,
      }),
      null,
    );
  assert.equal(
    readWritingHandoff(s, {
      ownerId: OWNER,
      id: REF,
      campaignId: CAMPAIGN,
      now: 1001,
    }).copy.title,
    "Selected title",
  );
});

test("accepted wording keeps complete owner edits and routes to the associated campaign", () => {
  const s = storage();
  const d = {
    ...draft(),
    source_system: "ifund_story_accepted_v1",
    campaign_id: CAMPAIGN,
  };
  const wording = {
    title: "Owner-edited title",
    summary: "Owner-edited summary",
    story: "One revised paragraph.\n\nAnother revised paragraph.",
  };
  const link = rememberWritingHandoff(
    s,
    { ownerId: OWNER, draft: d, selection: { wording }, campaignId: CAMPAIGN },
    { id: REF, now: 1000 },
  );
  assert.equal(link.target, `/campaigns/${CAMPAIGN}/edit?writing=${REF}`);
  assert.deepEqual(
    readWritingHandoff(s, {
      ownerId: OWNER,
      id: REF,
      campaignId: CAMPAIGN,
      now: 1001,
    }).copy,
    wording,
  );
  assert.throws(
    () =>
      rememberWritingHandoff(s, {
        ownerId: OWNER,
        draft: d,
        selection: { wording },
        campaignId: OTHER,
      }),
    /associated/,
  );
});

test("cancelled, foreign, partial-section and malformed source drafts cannot open the campaign editor", () => {
  for (const change of [
    { status: "cancelled" },
    { source_system: "unverified" },
    { id: "not-a-draft" },
    { payload: { section: "Only a section" } },
    { payload: { ...draft().payload, story: "" } },
  ])
    assert.throws(() =>
      rememberWritingHandoff(storage(), {
        ...input(),
        draft: { ...draft(), ...change },
      }),
    );
  assert.throws(() =>
    rememberWritingHandoff(storage(), {
      ...input(),
      selection: { title_index: 9, summary_index: 0 },
    }),
  );
  assert.throws(() =>
    rememberWritingHandoff(storage(), { ...input(), ownerId: null }),
  );
});

test("cleanup cannot erase a newer handoff or another account's writing", () => {
  const s = storage();
  rememberWritingHandoff(s, input(), { id: REF });
  forgetWritingHandoff(s, { ownerId: OTHER, id: REF });
  assert.ok(readWritingHandoff(s, { ownerId: OWNER, id: REF }));
  rememberWritingHandoff(s, input(), { id: DRAFT });
  forgetWritingHandoff(s, { ownerId: OWNER, id: REF });
  assert.ok(readWritingHandoff(s, { ownerId: OWNER, id: DRAFT }));
  forgetWritingHandoff(s, { ownerId: OWNER, id: DRAFT });
  assert.equal(readWritingHandoff(s, { ownerId: OWNER, id: DRAFT }), null);
});

test("blocked browser storage produces a plain message while the server draft remains untouched", () => {
  const s = {
    ...storage(),
    setItem: () => {
      throw Error("internal storage failure and private diagnostics");
    },
  };
  assert.throws(
    () => rememberWritingHandoff(s, input()),
    (error) =>
      error instanceof WritingHandoffError &&
      !error.message.includes("internal") &&
      error.message.includes("still saved"),
  );
});
