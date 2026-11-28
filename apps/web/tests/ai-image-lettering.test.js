import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeImageWords,
  findRenderedTextProblems,
  parseRenderedTextTranscription,
  verifyImageLettering,
  IMAGE_TEXT_MODEL,
  MAX_IMAGE_GENERATIONS,
} from "../../../worker/imageTextCheck.js";
import { routeImageStudio, IMAGE_MODEL } from "../../../worker/imageStudio.js";
import { routeImageImprove, IMAGE_EDIT_MODEL } from "../../../worker/imageImprove.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const baseEnv = {
  IFUND_IMAGE_AI_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock_public",
};
// Distinct format-valid JPEG payloads so tests can tell renders apart.
const imageA = "/9j/" + "A".repeat(80);
const imageB = "/9j/" + "B".repeat(80);
const imageC = "/9j/" + "C".repeat(80);

function fakeServices() {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    if (url.endsWith("/auth/v1/user"))
      return Response.json({ id: OWNER, app_metadata: { role: "member" } });
    if (url.includes("/rest/v1/ifund_ai_permission_preferences?"))
      return Response.json([{ owner_id: OWNER, allow_ai_campaign_drafts: true,
        allow_ai_outreach_drafts: true, allow_future_internal_ai_assistance: true }]);
    if (url.endsWith("/rpc/ifund_ai_content_reserve"))
      return Response.json({ allowed: true, state: "reserved", limit: 15, remaining: 14 });
    if (url.endsWith("/rpc/ifund_ai_content_complete")) return Response.json(true);
    if (url.endsWith("/rpc/ifund_trial_ai_generation_release")) return Response.json(true);
    if (url.endsWith("/rest/v1/rpc/ifund_ai_image_consume_free_quota"))
      return Response.json(true);
    throw Error("Unexpected external network call: " + url);
  };
  return { fetcher, calls };
}
const completions = (calls) =>
  calls.filter(url => url.endsWith("/rpc/ifund_ai_content_complete")).length;

/* ---------- pure comparison ---------- */

test("word normalization is case and punctuation insensitive", () => {
  assert.deepEqual(normalizeImageWords("Help,  A FAMILY!"), ["help", "a", "family"]);
  assert.deepEqual(normalizeImageWords(""), []);
  assert.deepEqual(normalizeImageWords(null), []);
});

test("correctly spelled intended wording passes, misspelling fails per word", () => {
  assert.equal(findRenderedTextProblems("Help a Family", "HELP A FAMILY").ok, true);
  const misspelled = findRenderedTextProblems("HEPL A FAMILY", "HELP A FAMILY");
  assert.equal(misspelled.ok, false);
  assert.deepEqual(misspelled.unexpected, ["hepl"]);
  assert.deepEqual(misspelled.missing, ["help"]);
  const dropped = findRenderedTextProblems("HELP A", "HELP A FAMILY");
  assert.equal(dropped.ok, false);
  assert.deepEqual(dropped.missing, ["family"]);
});

test("a text-free design is flagged only when lettering actually renders", () => {
  assert.equal(findRenderedTextProblems("", "").ok, true);
  const garbled = findRenderedTextProblems("SALE NOWW OPEN", "");
  assert.equal(garbled.ok, false);
  assert.deepEqual(garbled.unexpected, ["sale", "noww", "open"]);
});

test("transcription parsing honors the NONE sentinel and rejects unusable replies", () => {
  assert.equal(parseRenderedTextTranscription({ response: "NONE" }), "");
  assert.equal(parseRenderedTextTranscription({ response: " none. " }), "");
  assert.equal(parseRenderedTextTranscription({ response: "HELP A FAMILY" }), "HELP A FAMILY");
  assert.equal(parseRenderedTextTranscription({ response: "  " }), null);
  assert.equal(parseRenderedTextTranscription({}), null);
  assert.equal(parseRenderedTextTranscription(null), null);
});

/* ---------- verification orchestration (mocked vision model) ---------- */

test("verifyImageLettering classifies clean, lettered and unavailable renders", async () => {
  const clean = { AI: { run: async (model, options) => {
    assert.equal(model, IMAGE_TEXT_MODEL);
    assert.ok(options.image.startsWith("data:image/jpeg;base64," + imageA.slice(0, 8)));
    return { response: "NONE" };
  } } };
  assert.equal((await verifyImageLettering(clean, imageA, "")).state, "clean");

  const lettered = { AI: { run: async () => ({ response: "HEPL A FAMLY" }) } };
  const bad = await verifyImageLettering(lettered, imageA, "");
  assert.equal(bad.state, "problems");
  assert.ok(bad.problems.unexpected.includes("hepl"));

  const down = { AI: { run: async () => { throw Error("vision unavailable"); } } };
  assert.equal((await verifyImageLettering(down, imageA, "")).state, "unavailable");
  const malformed = { AI: { run: async () => ({}) } };
  assert.equal((await verifyImageLettering(malformed, imageA, "")).state, "unavailable");
  assert.equal((await verifyImageLettering({}, imageA, "")).state, "unavailable");
});

/* ---------- generate route: correction flow ---------- */

const GEN_API = "https://interplanetaryfund.com/api/ai/images/generate";
const genPayload = {
  title: "Help a family recover",
  description: "An illustrated cover supporting housing and emergency expenses.",
  style: "interstellar",
};
const genRequest = () => new Request(GEN_API, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer signed.mock.jwt" },
  body: JSON.stringify(genPayload),
});
// AI mock driven by a script: generation returns the next scripted image;
// the vision model transcribes from a per-image map.
function scriptedAI(images, transcriptions) {
  const generations = [];
  const ai = { run: async (model, options) => {
    if (model === IMAGE_TEXT_MODEL) {
      const image = images.find(candidate => options.image.endsWith(candidate));
      return { response: transcriptions[image] ?? "NONE" };
    }
    assert.equal(model, IMAGE_MODEL);
    generations.push(options.prompt);
    return { image: images[generations.length - 1] };
  } };
  return { ai, generations };
}

test("misspelled first render is regenerated and the member receives the corrected image", async () => {
  const service = fakeServices();
  const { ai, generations } = scriptedAI(
    [imageA, imageB],
    { [imageA]: "HEPL A FAMLY", [imageB]: "NONE" });
  const result = await routeImageStudio(genRequest(), { ...baseEnv, AI: ai }, service.fetcher);
  assert.equal(result.status, 200);
  const json = await result.json();
  assert.equal(json.image_base64, imageB, "the corrected render is what the member receives");
  assert.equal(json.lettering_check, "passed");
  assert.equal(generations.length, 2);
  assert.match(generations[1], /previous attempt contained letters/i,
    "the retry must carry corrective direction");
  assert.equal(completions(service.calls), 1, "allowance finalizes once, for the delivered image");
});

test("persistent misspelling yields no image and no finalized allowance", async () => {
  const service = fakeServices();
  const { ai, generations } = scriptedAI(
    [imageA, imageB, imageC],
    { [imageA]: "HEPL", [imageB]: "FAMLY", [imageC]: "RECOVR" });
  const result = await routeImageStudio(genRequest(), { ...baseEnv, AI: ai }, service.fetcher);
  assert.equal(result.status, 502);
  const json = await result.json();
  assert.equal(json.image_base64, undefined, "a misspelled image is never presented as finished");
  assert.match(json.error, /misspelled lettering/i);
  assert.equal(generations.length, MAX_IMAGE_GENERATIONS, "regeneration is bounded");
  assert.equal(completions(service.calls), 0,
    "a generation the member never received must not be finalized against their allowance");
});

test("clean first render is delivered with exactly one generation", async () => {
  const service = fakeServices();
  const { ai, generations } = scriptedAI([imageA], { [imageA]: "NONE" });
  const result = await routeImageStudio(genRequest(), { ...baseEnv, AI: ai }, service.fetcher);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).image_base64, imageA);
  assert.equal(generations.length, 1);
  assert.equal(completions(service.calls), 1);
});

test("unverifiable artwork fails closed without finalizing the allowance", async () => {
  const service = fakeServices();
  const ai = { run: async (model) => {
    if (model === IMAGE_TEXT_MODEL) throw Error("vision model unavailable");
    return { image: imageA };
  } };
  const result = await routeImageStudio(genRequest(), { ...baseEnv, AI: ai }, service.fetcher);
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /could not be verified/i);
  assert.equal(completions(service.calls), 0);
});

/* ---------- improve route: correction flow ---------- */

const IMPROVE_API = "https://interplanetaryfund.com/api/ai/images/improve";
const referenceBytes = Buffer.alloc(128, 0);
referenceBytes.set([0xff, 0xd8, 0xff], 0);
referenceBytes.set([0xff, 0xd9], 126);
const improvePayload = {
  title: "Help a family recover",
  description: "Illustrate safe housing and support after a disaster",
  style: "comic",
  reference_jpeg: referenceBytes.toString("base64"),
  confirmed_rights: true,
};
const improveRequest = () => new Request(IMPROVE_API, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer good.mock.token" },
  body: JSON.stringify(improvePayload),
});
function scriptedEditAI(images, transcriptions) {
  const generations = [];
  const ai = { run: async (model, args) => {
    if (model === IMAGE_TEXT_MODEL) {
      const image = images.find(candidate => args.image.endsWith(candidate));
      return { response: transcriptions[image] ?? "NONE" };
    }
    assert.equal(model, IMAGE_EDIT_MODEL);
    generations.push(args);
    return { image: images[generations.length - 1] };
  } };
  return { ai, generations };
}

test("improved render with mangled lettering is regenerated until clean", async () => {
  const service = fakeServices();
  const { ai, generations } = scriptedEditAI(
    [imageA, imageB],
    { [imageA]: "HOSUE FOR SALE", [imageB]: "NONE" });
  const result = await routeImageImprove(improveRequest(), { ...baseEnv, AI: ai }, service.fetcher);
  assert.equal(result.status, 200);
  const json = await result.json();
  assert.equal(json.image_base64, imageB);
  assert.equal(json.improved, true);
  assert.equal(json.lettering_check, "passed");
  assert.equal(generations.length, 2);
  assert.equal(completions(service.calls), 1);
});

test("improvement that never loses its lettering is refused, not finalized", async () => {
  const service = fakeServices();
  const { ai, generations } = scriptedEditAI(
    [imageA, imageB, imageC],
    { [imageA]: "SALE", [imageB]: "SAEL", [imageC]: "SALLE" });
  const result = await routeImageImprove(improveRequest(), { ...baseEnv, AI: ai }, service.fetcher);
  assert.equal(result.status, 502);
  const json = await result.json();
  assert.equal(json.image_base64, undefined);
  assert.match(json.error, /misspelled lettering/i);
  assert.equal(generations.length, MAX_IMAGE_GENERATIONS);
  assert.equal(completions(service.calls), 0);
});
