// Sprint 5 (2026-11-25): pure helpers for the unified Media Studio
// (40-page list, page 23). No DOM, no network, no fabricated results:
// every value here is either a user choice or computed from real media
// state. MediaStudio.jsx renders these tabs; the audio and viewing
// controls apply to real uploaded/generated media in the browser.

export const MEDIA_STUDIO_TABS = Object.freeze([
  { id: "generator", label: "Generator" },
  { id: "editor", label: "Editor" },
  { id: "audio", label: "Audio" },
  { id: "library", label: "Library" },
  { id: "publish", label: "Publish" },
]);

// Tab state lives in the URL (?tab=editor) so Studio tabs are deep-linkable.
// Unknown or missing values fall back to the Generator.
export function tabFromParam(value) {
  const found = MEDIA_STUDIO_TABS.find((tab) => tab.id === String(value || "").toLowerCase());
  return found ? found.id : "generator";
}

// Platform framing for the Editor preview. The aspect ratio reframes the
// preview container; the same ratio sizes a downloaded frame still.
export const FRAME_OPTIONS = Object.freeze([
  { id: "1:1", label: "Square 1:1", aspect: "1 / 1" },
  { id: "4:5", label: "Portrait 4:5", aspect: "4 / 5" },
  { id: "9:16", label: "Story 9:16", aspect: "9 / 16" },
  { id: "16:9", label: "Wide 16:9", aspect: "16 / 9" },
]);

export function frameForId(value) {
  return FRAME_OPTIONS.find((option) => option.id === value) || FRAME_OPTIONS[2];
}

// Viewing / wavelength controls, applied LIVE to the preview as changed.
// Plain-language grades (G7): no "spectral" or "DSP" jargon in labels.
export const VIEW_GRADES = Object.freeze([
  { id: "none", label: "No grade", filter: "" },
  { id: "warm", label: "Warm glow", filter: "sepia(0.25) saturate(1.15)" },
  { id: "cool", label: "Cool night", filter: "hue-rotate(-12deg) saturate(1.1)" },
  { id: "bold", label: "High contrast", filter: "contrast(1.25) saturate(1.2)" },
  { id: "soft", label: "Soft light", filter: "brightness(1.08) contrast(0.92) saturate(0.9)" },
]);

export function gradeForId(value) {
  return VIEW_GRADES.find((grade) => grade.id === value) || VIEW_GRADES[0];
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

// Builds the exact CSS filter string applied to the <video>/<img> preview.
// Sliders are 0-200 (100 = unchanged); warmth -50..50 (negative = cooler).
export function buildVideoFilter({ brightness = 100, contrast = 100, saturation = 100, warmth = 0, grade = "none" } = {}) {
  const parts = [
    `brightness(${clampNumber(brightness, 100, 0, 200)}%)`,
    `contrast(${clampNumber(contrast, 100, 0, 200)}%)`,
    `saturate(${clampNumber(saturation, 100, 0, 200)}%)`,
  ];
  const warm = clampNumber(warmth, 0, -50, 50);
  if (warm > 0) parts.push(`sepia(${(warm / 100).toFixed(2)})`);
  if (warm < 0) parts.push(`hue-rotate(${(warm / 5).toFixed(1)}deg)`);
  const gradeFilter = gradeForId(grade).filter;
  if (gradeFilter) parts.push(gradeFilter);
  return parts.join(" ");
}

// Audio-for-social: three real layers mixed in the browser with the
// Web Audio API. Each layer is a file the user uploads (voice, music,
// effects) — a mixed file is never claimed to be separated into layers.
// Gains are linear 0..1 relative levels.
export const AUDIO_LAYERS = Object.freeze([
  { id: "voice", label: "Voice" },
  { id: "music", label: "Music" },
  { id: "effects", label: "Effects" },
]);

export const AUDIO_PRESETS = Object.freeze([
  { id: "balanced", label: "Balanced", gains: { voice: 0.9, music: 0.6, effects: 0.6 } },
  { id: "clear-voice", label: "Clear voice", gains: { voice: 1, music: 0.35, effects: 0.4 } },
  { id: "music-forward", label: "Music forward", gains: { voice: 0.6, music: 0.95, effects: 0.5 } },
  { id: "quiet-background", label: "Quiet background", gains: { voice: 0.85, music: 0.25, effects: 0.3 } },
]);

export function presetForId(value) {
  return AUDIO_PRESETS.find((preset) => preset.id === value) || AUDIO_PRESETS[0];
}

// Plain-language read of the current mix balance, from the real gains.
export function describeBalance(gains = {}) {
  const voice = clampNumber(gains.voice, 0, 0, 1);
  const music = clampNumber(gains.music, 0, 0, 1);
  const effects = clampNumber(gains.effects, 0, 0, 1);
  if (voice === 0 && music === 0 && effects === 0) return "All layers are silent.";
  if (voice >= music + 0.3 && voice >= effects + 0.3) return "Voice leads — good for spoken posts.";
  if (music >= voice + 0.3 && music >= effects + 0.3) return "Music leads — good for mood-led clips.";
  if (effects >= voice + 0.3 && effects >= music + 0.3) return "Effects lead — check they do not cover the voice.";
  return "Layers are close in level — listen for the voice cutting through.";
}

// Plain-language level check from measured peak/RMS (0..1) of the live mix.
// Measured in the browser only; never presented as a certified loudness value.
export function classifyMixLevel({ peak = 0, rms = 0 } = {}) {
  const measuredPeak = clampNumber(peak, 0, 0, 1);
  const measuredRms = clampNumber(rms, 0, 0, 1);
  if (measuredPeak >= 0.99) return { level: "Too loud", note: "The mix is clipping at the top — turn a layer down before sharing." };
  if (measuredRms < 0.02) return { level: "Very quiet", note: "Almost no sound is coming through — check a layer is loaded and its level is up." };
  if (measuredRms < 0.08) return { level: "Quiet", note: "The mix is quiet — listeners on phones may struggle to hear it." };
  if (measuredRms <= 0.35) return { level: "Healthy level", note: "The mix sits at a comfortable listening level." };
  return { level: "Loud", note: "The mix is loud — check it does not distort on a phone speaker." };
}

// Test tones generated in the browser (oscillator / noise buffer). Real
// Web Audio sources; no downloaded or claimed-mastered audio.
export const TONE_PRESETS = Object.freeze([
  { id: "528", label: "528 Hz tone", frequency: 528 },
  { id: "432", label: "432 Hz tone", frequency: 432 },
  { id: "440", label: "440 Hz tone", frequency: 440 },
]);

export function toneForId(value) {
  return TONE_PRESETS.find((tone) => tone.id === value) || TONE_PRESETS[0];
}

export const STUDIO_LIBRARY_KEY = "ifund-media-studio-library-v1";
