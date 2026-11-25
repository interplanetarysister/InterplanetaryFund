import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAudioSamples } from "../src/lib/mediaAudioMetrics.mjs";

test("silent audio reports quiet duration without claiming emotional impact", () => {
  const result = analyzeAudioSamples([new Float32Array(1000)], 1000);
  assert.equal(result.peak, 0);
  assert.equal(result.rms, 0);
  assert.equal(result.quietSeconds, 1);
  assert.match(result.limitations, /not a validated measure of emotion/);
});

test("full-scale audio is detected as near-clipped", () => {
  const result = analyzeAudioSamples([Float32Array.from({ length: 1000 }, (_, i) => i % 2 ? -1 : 1)], 1000);
  assert.equal(result.peak, 1);
  assert.equal(result.clippedSampleFraction, 1);
  assert.equal(result.quietSeconds, 0);
});

test("invalid audio measurements fail closed", () => {
  assert.throws(() => analyzeAudioSamples([], 1000), /Valid decoded audio/);
  assert.throws(() => analyzeAudioSamples([new Float32Array(3), new Float32Array(2)], 1000), /matching/);
  assert.throws(() => analyzeAudioSamples([new Float32Array(3)], 0), /Valid decoded audio/);
  assert.throws(() => analyzeAudioSamples([Float32Array.from([0, Number.NaN])], 250), /invalid values/);
});
