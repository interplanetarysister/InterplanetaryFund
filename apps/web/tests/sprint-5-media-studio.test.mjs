import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  AUDIO_PRESETS,
  FRAME_OPTIONS,
  MEDIA_STUDIO_TABS,
  VIEW_GRADES,
  buildVideoFilter,
  classifyMixLevel,
  describeBalance,
  frameForId,
  gradeForId,
  presetForId,
  tabFromParam,
  toneForId,
} from "../src/lib/mediaStudio.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Sprint 5 (2026-11-25): unified Media Studio (40-page list, page 23).
// Generator / Editor / Audio / Library / Publish at /media-studio;
// /ai-images stays as a compatibility redirect to ?tab=generator.

test("studio tabs are exactly the five approved tabs, in order, deep-linked by ?tab=", () => {
  assert.deepEqual(
    MEDIA_STUDIO_TABS.map((tab) => tab.label),
    ["Generator", "Editor", "Audio", "Library", "Publish"],
  );
  assert.equal(new Set(MEDIA_STUDIO_TABS.map((tab) => tab.id)).size, 5);
  assert.equal(tabFromParam("editor"), "editor");
  assert.equal(tabFromParam("audio"), "audio");
  assert.equal(tabFromParam("publish"), "publish");
  assert.equal(tabFromParam(""), "generator");
  assert.equal(tabFromParam("unknown-tab"), "generator");
  assert.equal(tabFromParam(null), "generator");
  const page = read("src/pages/MediaStudio.jsx");
  for (const tab of MEDIA_STUDIO_TABS) {
    assert.ok(page.includes(`id="studio-panel-${tab.id}"`), `missing panel ${tab.id}`);
    assert.ok(page.includes(`aria-labelledby="studio-tab-${tab.id}"`), `missing tab button ${tab.id}`);
  }
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected=\{tab === item\.id\}/);
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /params\.get\("tab"\)/);
  assert.match(page, /setParams\(\{ tab:/);
});

test("viewing controls build the exact live filter string for the preview", () => {
  assert.equal(
    buildVideoFilter({ brightness: 100, contrast: 100, saturation: 100, warmth: 0, grade: "none" }),
    "brightness(100%) contrast(100%) saturate(100%)",
  );
  assert.equal(
    buildVideoFilter({ brightness: 115, contrast: 90, saturation: 130, warmth: 25, grade: "warm" }),
    "brightness(115%) contrast(90%) saturate(130%) sepia(0.25) sepia(0.25) saturate(1.15)",
  );
  assert.equal(
    buildVideoFilter({ brightness: 100, contrast: 100, saturation: 100, warmth: -20, grade: "cool" }),
    "brightness(100%) contrast(100%) saturate(100%) hue-rotate(-4.0deg) hue-rotate(-12deg) saturate(1.1)",
  );
  assert.equal(buildVideoFilter({}), "brightness(100%) contrast(100%) saturate(100%)");
  assert.equal(buildVideoFilter({ brightness: "nope", grade: "missing" }), "brightness(100%) contrast(100%) saturate(100%)");
  assert.equal(gradeForId("bold").label, "High contrast");
  assert.equal(gradeForId("nope").id, "none");
  assert.equal(frameForId("9:16").aspect, "9 / 16");
  assert.equal(frameForId("16:9").label, "Wide 16:9");
  assert.equal(frameForId("nope").id, "9:16");
  assert.deepEqual(FRAME_OPTIONS.map((option) => option.id), ["1:1", "4:5", "9:16", "16:9"]);
  assert.deepEqual(VIEW_GRADES.map((grade) => grade.id), ["none", "warm", "cool", "bold", "soft"]);
  const page = read("src/pages/MediaStudio.jsx");
  assert.match(page, /<video[^>]*style=\{\{ filter \}\}/);
  assert.match(page, /style=\{\{ filter \}\}/);
  assert.match(page, /buildVideoFilter\(viewing\)/);
  assert.match(page, /VIEWING CONTROLS — UNDER THE VIDEO, LIVE AS CHANGED/);
  assert.match(page, /change this preview the moment you move them/);
  assert.match(page, /FRAME_OPTIONS\.map/);
  assert.match(page, /Show the safe-zone guide/);
  assert.match(page, /SAFE ZONE — KEEP TEXT INSIDE/);
  assert.match(page, /canvas\.toBlob/);
  assert.match(page, /context\.filter = filter/);
  assert.match(page, /drawImage\(video,/);
  assert.match(page, /Download frame still \(current look \+ frame\)/);
  assert.match(page, /The original file is unchanged/);
  assert.match(page, /CRASH-TEST LAB \/\/ EDITOR/);
});

test("Generator reuses the existing image studio and states video generation honestly", () => {
  const page = read("src/pages/MediaStudio.jsx");
  assert.match(page, /import AIImageStudio from "\.\/AIImageStudio"/);
  assert.match(page, /<AIImageStudio/);
  assert.match(page, /onArtworkReady=\{handleArtworkReady\}/);
  assert.match(page, /onArtworkSaved=\{handleArtworkSaved\}/);
  assert.match(page, /onSendToEditor=/);
  assert.match(page, /Video generation is not connected yet/);
  assert.match(page, /no video-generation provider wired in/);
  assert.match(page, /does not pretend to generate a video/);
  // No second image generator may be built inside the Studio.
  assert.doesNotMatch(page, /\/api\/ai\/images\/generate/);
  assert.doesNotMatch(page, /flux-1-schnell/);
  assert.doesNotMatch(page, /Workers AI.*generate|generate.*Workers AI/i);
  const studio = read("src/pages/AIImageStudio.jsx");
  assert.match(studio, /AIImageStudio\(\{ onArtworkReady, onArtworkSaved, onSendToEditor \}/);
  assert.match(studio, /onArtworkReady\?\.\(\{ file: jpeg, url, kind:/);
  assert.match(studio, /onArtworkSaved\?\.\(url\)/);
  assert.match(studio, /Send to Editor/);
  assert.match(studio, /onSendToEditor &&/);
});

test("Send-to-Editor moves an item into the Editor tab", () => {
  const page = read("src/pages/MediaStudio.jsx");
  assert.match(page, /function sendToEditor\(item\)/);
  assert.match(page, /setSelectedId\(item\.id\)/);
  assert.match(page, /setTab\("editor"\)/);
  assert.match(page, /entry\.file === file \|\| entry\.url === url/);
  assert.match(page, /Open in Editor/);
  assert.match(page, /selectedId/);
  assert.match(page, /selected\.kind === "video"/);
});

test("Audio tab mixes real uploaded layers with the Web Audio API", () => {
  assert.equal(AUDIO_PRESETS.length, 4);
  assert.deepEqual(presetForId("clear-voice").gains, { voice: 1, music: 0.35, effects: 0.4 });
  assert.equal(presetForId("nope").id, "balanced");
  assert.equal(describeBalance({ voice: 1, music: 0.3, effects: 0.3 }), "Voice leads — good for spoken posts.");
  assert.equal(describeBalance({ voice: 0, music: 0, effects: 0 }), "All layers are silent.");
  assert.match(describeBalance({ voice: 0.6, music: 0.6, effects: 0.6 }), /close in level/);
  assert.equal(classifyMixLevel({ peak: 1, rms: 0.5 }).level, "Too loud");
  assert.equal(classifyMixLevel({ peak: 0.5, rms: 0.01 }).level, "Very quiet");
  assert.equal(classifyMixLevel({ peak: 0.5, rms: 0.05 }).level, "Quiet");
  assert.equal(classifyMixLevel({ peak: 0.5, rms: 0.2 }).level, "Healthy level");
  assert.equal(classifyMixLevel({ peak: 0.5, rms: 0.6 }).level, "Loud");
  assert.equal(toneForId("528").frequency, 528);
  assert.equal(toneForId("nope").frequency, 528);
  const page = read("src/pages/MediaStudio.jsx");
  assert.match(page, /AudioContext/);
  assert.match(page, /createGain\(\)/);
  assert.match(page, /createAnalyser\(\)/);
  assert.match(page, /createStereoPanner\(\)/);
  assert.match(page, /decodeAudioData/);
  assert.match(page, /getFloatTimeDomainData/);
  assert.match(page, /getByteFrequencyData/);
  assert.match(page, /createOscillator\(\)/);
  assert.match(page, /Save mix as A/);
  assert.match(page, /Listen to A/);
  assert.match(page, /measured live from your mix/);
  assert.match(page, /no audio backend/);
  assert.match(page, /never claimed to be\s*\n?\s*split into layers/);
  // Manual-trace repairs: a failed decode must stop already-started layers;
  // A/B listen must keep its indicator while playback starts; unmount must
  // stop the tone's source, not call .stop() on the { source, gain } holder.
  assert.match(page, /A failed decode mid-mix must not leave earlier layers playing/);
  assert.match(page, /stopSources\(\);\n\s*setPlaying\(false\);/);
  assert.match(page, /playMix\(\{ keepSnapshot = false \} = \{\}\)/);
  assert.match(page, /void playMix\(\{ keepSnapshot: true \}\)/);
  assert.match(page, /engine\.tone\.source\.stop\(\)/);
});

test("Library shows real Studio items with an honest empty state; Publish links to the social composer", () => {
  const page = read("src/pages/MediaStudio.jsx");
  assert.match(page, /No media yet\. Generate artwork in the Generator tab or upload a file above\./);
  assert.match(page, /no media list to fetch/);
  assert.match(page, /This session only/);
  assert.match(page, /Saved on this device/);
  assert.match(page, /localStorage\.getItem\(STUDIO_LIBRARY_KEY\)/);
  assert.match(page, /Open the social composer/);
  assert.match(page, /to="\/social"/);
  assert.match(page, /Copy post text with link/);
  assert.match(page, /cannot be attached to an IFund Social post\n?\s*yet/);
  assert.match(page, /Save to IFund cover storage/);
  assert.match(page, /uploadCampaignCover\(authClient\(\), file\)/);
  assert.match(page, /Load into Audio mix/);
  assert.match(page, /function loadAudioItem\(item\)/);
  assert.match(page, /loaded as the .* track/);
  assert.match(page, /Clear .* track/);
});

test("Media Studio contains no test content, fabricated results, or Stitch jargon", () => {
  const page = read("src/pages/MediaStudio.jsx");
  const lib = read("src/lib/mediaStudio.mjs");
  for (const source of [page, lib]) {
    assert.doesNotMatch(source, /Elena Vance/i);
    assert.doesNotMatch(source, /Commander Vance/i);
    assert.doesNotMatch(source, /Vance/);
    assert.doesNotMatch(source, /retention.*%/i);
    assert.doesNotMatch(source, /engagement spike/i);
    assert.doesNotMatch(source, /G-force|G-FORCE/);
    assert.doesNotMatch(source, /viral.*score/i);
    assert.doesNotMatch(source, /3-stem DSP/i);
    assert.doesNotMatch(source, /spectral FFT/i);
    assert.doesNotMatch(source, /Lissajous/i);
    assert.doesNotMatch(source, /audience stress telemetry/i);
    assert.doesNotMatch(source, /lorem/i);
  }
  assert.match(page, /no audience scores/);
  assert.match(page, /no invented reach/);
});

test("routes, titles, navigation and acceptance entries wire the Studio in", () => {
  const app = read("src/App.jsx");
  assert.match(app, /path="\/media-studio" element=\{<MemberAccess><MediaStudio/);
  assert.match(app, /path="\/ai-images" element=\{<MemberAccess><Navigate to="\/media-studio\?tab=generator" replace/);
  assert.doesNotMatch(app, /AIImageStudio/);
  const layout = read("src/components/Layout.jsx");
  assert.match(layout, /"\/media-studio": "Media Studio"/);
  assert.match(layout, /\{ to: "\/media-studio", label: "Media Studio"/);
  const nav = read("src/components/communications/PublishingWorkflowNav.jsx");
  assert.match(nav, /href: "\/media-studio\?tab=generator"/);
  const workspace = read("src/pages/CampaignWorkspace.jsx");
  assert.match(workspace, /to="\/media-studio\?tab=generator"/);
  assert.doesNotMatch(workspace, /to="\/ai-images"/);
  const acceptance = JSON.parse(read("ci/route-acceptance.json"));
  const byRoute = new Map(acceptance.routes.map((entry) => [entry.route, entry]));
  assert.ok(byRoute.has("/media-studio"), "missing /media-studio acceptance entry");
  assert.equal(byRoute.get("/media-studio").role, "member");
  assert.equal(byRoute.get("/media-studio").component, "MediaStudio");
  assert.ok(byRoute.has("/ai-images"), "/ai-images must stay in the acceptance matrix as a redirect");
  assert.equal(byRoute.get("/ai-images").component, "MediaStudio");
  assert.match(byRoute.get("/ai-images").source_evidence, /MediaStudio\.jsx/);
  // The third-party Stitch tour inventory must list the new route exactly,
  // with /ai-images marked as the redirect it now is.
  const tour = read("public/stitch-review/index.html");
  assert.match(tour, /"path":"\/media-studio","label":"Media Studio","access":"Member"/);
  assert.match(tour, /"path":"\/ai-images","label":"AI Image Studio","access":"Member","group":"Discover & Tools","dynamic":false,"redirected":true/);
});
