import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findCaptionNonsense, captionIsCoherent, fallbackCaption,
} from "../src/lib/captionQuality.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("letter salad, fake words and keyboard mash are caught", () => {
  for (const bad of [
    "Flibberty gibbet snizzle framdoodle",
    "Xqzwkj plmrt vbnm asdfgh",
    "Soooo exciiiited for the bake saleeeee",
    "Gardening togetherrr with fri3nds 4ever",
    "Blorple snizzle wumpus fronk",
  ])
    assert.ok(findCaptionNonsense(bad).length > 0, bad);
});

test("ordinary creative captions, names and hashtags pass", () => {
  for (const good of [
    "A slow sunrise over the community garden",
    "Fresh starts grow here, one seed at a time",
    "Sunflowers for Mrs. Alvarez's classroom",
    "Community garden cleanup day #CommunityGarden #SupportLocal",
    "New books for the Lincoln Elementary library",
    "Rhythm and hymns at the harvest festival",
    "Bake sale Saturday — fresh bread, warm hearts, big smiles",
    "Help Our Family",
    "Weekend wheels: free bike repairs for neighborhood kids",
  ])
    assert.equal(captionIsCoherent(good, { contextWords: ["Alvarez", "Lincoln"] }), true, good);
});

test("the member's own context words are never false-flagged", () => {
  // One unknown word in a longer caption is tolerated (it may be a name);
  // an invented word dominating the caption is caught — unless it comes
  // from the member's own context, where it is their name to use.
  assert.equal(captionIsCoherent("Zorblax family picnic day"), true);
  const caption = "Zorblax zorblax picnic day";
  assert.ok(findCaptionNonsense(caption).length > 0);
  assert.equal(captionIsCoherent(caption, { contextWords: ["Zorblax"] }), true);
});

test("fallback is the factual title, or a plain factual sentence", () => {
  assert.equal(fallbackCaption("Rebuild the Westside Playground"), "Rebuild the Westside Playground");
  assert.equal(fallbackCaption(""), "A community fundraiser on Interplanetary Fund.");
  assert.equal(captionIsCoherent(fallbackCaption("")), true);
});

test("both caption surfaces offer AI wording through the shared suggestion API", () => {
  const studio = read("../src/pages/AIImageStudio.jsx");
  const creator = read("../src/components/campaigns/CampaignImageChoices.jsx");
  const api = read("../src/api/captionSuggestions.js");
  assert.match(api, /\/api\/ai\/captions\/generate/);
  for (const surface of [studio, creator]) {
    assert.match(surface, /Suggest wording with AI/);
    assert.match(surface, /suggestCaption\(/);
    assert.match(surface, /source === "fallback"|source==="fallback"/);
    // The exact-print contract is unchanged: approved text is rendered
    // locally, the image model still draws no lettering.
    assert.match(surface, /overlayExactArtworkCaption\(raw,(exactCaption|caption)\)/);
  }
  assert.match(studio, /Use title exactly/);
  assert.match(creator, /Use campaign title exactly/);
});
