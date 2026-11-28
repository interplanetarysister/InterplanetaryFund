import test from "node:test";
import assert from "node:assert/strict";
import { storyRoute } from "../worker/agents/story.js";

// Owner directive 2026-11-28 acceptance fixtures: the campaign-writing AI
// must interpret a member's raw needs as private input intelligence and
// produce public copy that reframes them — never pleading, raw-need
// statements or internal objectives restated as the public appeal.
const uid = "11111111-1111-4111-8111-111111111111";
const rid = "22222222-2222-4222-8222-222222222222";
const env = {
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-key",
  IFUND_STORY_ENABLED: "enabled",
  IFUND_STORY_AI_ENABLED: "enabled",
};
const request = (body) =>
  new Request("https://preview.test/api/agents/story/drafts", {
    method: "POST",
    headers: {
      authorization: "Bearer valid.jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
const makeFetcher = (capture = {}) => async (url, init) => {
  const name = url.split("/").pop();
  if (name === "ifund_current_account_is_active") return Response.json(true);
  if (name === "user")
    return Response.json({ id: uid, email_confirmed_at: "2026-01-01" });
  if (url.includes("/ifund_ai_permission_preferences?"))
    return Response.json([{ owner_id: uid, allow_ai_campaign_drafts: true, allow_ai_outreach_drafts: true, allow_future_internal_ai_assistance: true }]);
  if (name === "ifund_story_begin")
    return Response.json({ state: "claimed", lease: rid });
  if (name === "ifund_story_context")
    return Response.json({ campaign: null, research: null });
  if (name === "ifund_story_finish") {
    const body = JSON.parse(init.body);
    capture.finished = body.p_result;
    return Response.json({ id: rid, status: "draft", payload: body.p_result });
  }
  throw Error("Unexpected URL " + url);
};
// A mocked model that answers with each draft in turn, then keeps
// answering with the last one.
const sequencedAI = (drafts, counter) => ({
  run: async () => {
    const draft = drafts[Math.min(counter.calls++, drafts.length - 1)];
    return { response: JSON.stringify(draft) };
  },
});
const storyFrom = (sentences, pad) => {
  let story = sentences.join(" ");
  while (story.length < 1150) story += " " + pad;
  return story;
};

test("fixture: 'I need users for iFund' becomes mission copy after one corrective regeneration", async () => {
  const violating = {
    titles: [
      "A Platform Where Every Fundraiser Finds an Audience",
      "We Need Users for Interplanetary Fund",
      "Neighbors Helping Neighbors Reach Their Goals",
      "Small Campaigns, Real People, Visible Change",
      "Where a Bake Sale and a Medical Fund Meet Support",
    ],
    summaries: [
      "Interplanetary Fund connects people raising money for real needs with donors who want to help them succeed.",
      "From medical bills to community projects, campaigns here are built by everyday people and backed by neighbors.",
    ],
    story: storyFrom([
      "We need users for Interplanetary Fund so more fundraisers can find the donors who will back them.",
      "Every week, people across the country face bills and moments they cannot carry alone.",
    ], "A campaign here turns a private worry into a public rally, with updates every supporter can follow."),
    image_prompt: "A diverse group of neighbors gathered around a community noticeboard of fundraisers.",
  };
  const clean = {
    titles: [
      "Every Fundraiser Deserves an Audience",
      "Where Neighbors Back Life's Biggest Moments",
      "Medical Bills, Community Dreams, One Place to Rally",
      "Real People Raising Real Help, Together",
      "Your Campaign, Told Well, Backed by Neighbors",
    ],
    summaries: [
      "Interplanetary Fund gives everyday fundraisers the tools and the audience to turn a hard moment into a supported one.",
      "A teacher's classroom fund, a father's surgery bills, a town's new playground — campaigns here connect real needs with people ready to help.",
    ],
    story: storyFrom([
      "A fundraiser usually starts alone: one person, one hard moment, and a story they are not sure how to tell.",
      "Interplanetary Fund exists so that moment is never faced alone, pairing each campaign with guidance, an audience and a clear way for supporters to act.",
      "When a campaign launches here, neighbors can give, share and follow along as the goal turns into groceries delivered, bills covered and projects finished.",
    ], "Every campaign page reports progress openly, so supporters always know what their part made possible."),
    image_prompt: "A diverse group of neighbors gathered around a community noticeboard of fundraisers.",
  };
  const counter = { calls: 0 };
  const capture = {};
  const res = await storyRoute(
    request({
      details: "I need users for Interplanetary Fund. The platform helps everyday fundraisers create campaigns and connect with donors who care.",
      request_id: rid,
    }),
    { ...env, AI: sequencedAI([violating, clean], counter) },
    makeFetcher(capture),
  );
  assert.equal(res.status, 201);
  assert.equal(counter.calls, 2);
  const payload = JSON.stringify(capture.finished);
  assert.doesNotMatch(payload, /need users/i);
  assert.match(capture.finished.story, /fundraiser/i);
  assert.match(capture.finished.story, /supporter|neighbors/i);
});

test("fixture: a car need becomes transportation framing; uncorrectable story pleading is stripped, never stored", async () => {
  const cleanBlock = [
    "The shift starts at eleven at night, long after the last bus has left the depot.",
    "For the past month, getting there has meant a borrowed ride, a long walk along the highway shoulder, or a taxi fare that eats the first two hours of pay.",
    "Reliable transportation changes the whole equation: arriving on time, every shift, keeps the job secure and the paycheck steady.",
    "It also means Sunday afternoons with his mother across town, and a daughter picked up from practice without a scramble of favors.",
    "The warehouse crew counts on him, and he has not missed a shift yet — this campaign is about keeping it that way.",
  ].join(" ");
  const violating = {
    titles: [
      "Keep the Night Shift Within Reach",
      "A Reliable Ride Keeps a Steady Job",
      "One Worker, One Long Road, One Community",
      "Getting to Work Should Not Be the Hardest Part",
      "Help a Neighbor Keep Showing Up",
    ],
    summaries: [
      "A night-shift warehouse worker needs dependable transportation to keep the job his family counts on.",
      "Reliable transportation means steady shifts, steady pay and Sundays with family — here is the plan to get there.",
    ],
    story: storyFrom([
      "I need money to buy myself a car.",
      cleanBlock,
    ], "Supporters will see exactly what changed the first week the commute is reliable again."),
    image_prompt: "A warehouse worker at dawn locking a modest sedan outside a distribution center.",
  };
  const counter = { calls: 0 };
  const capture = {};
  const res = await storyRoute(
    request({
      details: "I need money to buy myself a car. I work the night shift at a warehouse across town and my old car died last month.",
      request_id: rid,
    }),
    { ...env, AI: sequencedAI([violating], counter) },
    makeFetcher(capture),
  );
  assert.equal(res.status, 201);
  assert.equal(counter.calls, 2);
  assert.doesNotMatch(capture.finished.story, /need money/i);
  assert.doesNotMatch(capture.finished.story, /buy myself/i);
  assert.match(capture.finished.story, /night|shift/i);
  assert.match(capture.finished.story, /transportation|commute/i);
  assert.ok(capture.finished.story.trim().length >= 1000);
});

test("fixture: a $10,000 goal is itemized in prose, never pleaded as 'help me raise $10,000'", async () => {
  const violating = {
    titles: [
      "A Dry Gym for Two Hundred Kids",
      "Fix the Roof, Save the Season",
      "The Youth Center Needs Its Roof Back",
      "Rain Stays Out, Games Stay On",
      "One Roof Between Kids and the Weather",
    ],
    summaries: [
      "The youth center gym floods every time it rains; a new roof keeps two hundred kids playing all winter.",
      "A contractor has quoted the full repair — this campaign walks through exactly what every dollar does.",
    ],
    story: storyFrom([
      "Please help me raise $10,000 so these kids can have their gym back.",
      "Every rainy week, buckets line the court and practice moves to a parking lot.",
    ], "The center posts photos of every stage, from the first torn shingle to the first dry practice."),
    image_prompt: "Children playing basketball in a bright school gym while rain streaks the windows.",
  };
  const clean = {
    titles: violating.titles,
    summaries: violating.summaries,
    story: storyFrom([
      "Every rainy week, buckets line the court and practice moves to a parking lot.",
      "The contractor's quote breaks down plainly: $6,000 for materials, $2,500 for labor, and $1,500 to repair the water damage hiding underneath the old roof.",
      "When the work is done, two hundred kids get their gym back for the whole season — practices, games and the after-school program that keeps them off the street.",
    ], "The center posts photos of every stage, from the first torn shingle to the first dry practice."),
    image_prompt: violating.image_prompt,
  };
  const counter = { calls: 0 };
  const capture = {};
  const res = await storyRoute(
    request({
      details: "Our youth center roof leaks every time it rains. The contractor quoted $10,000 to replace it, and the gym is where two hundred kids play after school.",
      request_id: rid,
    }),
    { ...env, AI: sequencedAI([violating, clean], counter) },
    makeFetcher(capture),
  );
  assert.equal(res.status, 201);
  assert.equal(counter.calls, 2);
  assert.doesNotMatch(capture.finished.story, /help me raise/i);
  assert.match(capture.finished.story, /\$10,000|\$6,000/);
  assert.match(capture.finished.story, /materials/);
});

test("a title that still pleads after regeneration fails closed instead of being stored", async () => {
  const violating = {
    titles: [
      "Help Me Raise $10,000 for the Youth Center",
      "Fix the Roof, Save the Season",
      "The Youth Center Needs Its Roof Back",
      "Rain Stays Out, Games Stay On",
      "One Roof Between Kids and the Weather",
    ],
    summaries: [
      "The youth center gym floods every time it rains; a new roof keeps two hundred kids playing all winter.",
      "A contractor has quoted the full repair — this campaign walks through exactly what every dollar does.",
    ],
    story: storyFrom([
      "Every rainy week, buckets line the court and practice moves to a parking lot.",
    ], "The center posts photos of every stage, from the first torn shingle to the first dry practice."),
    image_prompt: "Children playing basketball in a bright school gym while rain streaks the windows.",
  };
  const counter = { calls: 0 };
  const capture = {};
  const res = await storyRoute(
    request({
      details: "Our youth center roof leaks every time it rains and the gym floods after every storm.",
      request_id: rid,
    }),
    { ...env, AI: sequencedAI([violating], counter) },
    makeFetcher(capture),
  );
  assert.equal(res.status, 502);
  assert.equal(counter.calls, 2);
  assert.equal(capture.finished, null);
});

test("section revisions get the same discretion: pleading is stripped from the stored section", async () => {
  const violatingSection = {
    section: "I need money for a new stove, so please donate to me. The kitchen serves forty families every week, and a working stove means hot meals never miss a day.",
  };
  const counter = { calls: 0 };
  const capture = {};
  const res = await storyRoute(
    request({
      details: "The community kitchen serves forty families a week and its stove has stopped working.",
      section: "The kitchen serves forty families every week with hot meals and groceries.",
      request_id: rid,
    }),
    { ...env, AI: sequencedAI([violatingSection], counter) },
    makeFetcher(capture),
  );
  assert.equal(res.status, 201);
  assert.equal(counter.calls, 2);
  assert.doesNotMatch(capture.finished.section, /need money|donate to me/i);
  assert.match(capture.finished.section, /forty families/);
});
