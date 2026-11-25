/** An editorial checklist, not a statistical prediction or model inference. */
export function evaluatePostDraft(value) {
  const text = String(value || "").trim();
  if (!text) return { score: null, items: [] };
  const words = text.split(/\s+/).filter(Boolean);
  const items = [
    { label: "Clear action or next step", pass: /\b(share|read|visit|join|help|support|volunteer|learn|donate|reply|contact)\b/i.test(text) },
    { label: "Readable length for a short post", pass: words.length >= 12 && words.length <= 130 },
    { label: "Specific context beyond a generic appeal", pass: /\b(because|to help|so that|for our|for the|funds? (?:will|go|toward)|need|goal|project)\b/i.test(text) },
    { label: "Sentence structure and accessible punctuation", pass: /[.!?]/.test(text) && !/([!?])\1{2,}/.test(text) },
    { label: "No unsupported urgency or guaranteed outcome phrasing", pass: !/\b(guaranteed?|100% success|everyone must|last chance|miracle cure)\b/i.test(text) },
  ];
  return { score: items.filter(item => item.pass).length * 20, items };
}

export function summarizeAudienceFeedback(ratings) {
  const valid = ratings.filter(n => Number.isInteger(n) && n >= 1 && n <= 5);
  return { count: valid.length, mean: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null };
}

/**
 * Directional media-response hypotheses only. There is no population-trained
 * calibration dataset and therefore no valid numerical outcome probabilities.
 * Each outcome requires a different validation target and denominators.
 */
export function analyzeMediaResponse({ text = "", seconds = null, format = "post", audio = false, captions = false, audience = "" } = {}) {
  const body = String(text).trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  const hasAction = /\b(share|read|visit|join|help|support|volunteer|learn|donate|reply|contact)\b/i.test(body);
  const hasSpecifics = /\b(because|to help|so that|for our|for the|funds? (?:will|go|toward)|need|goal|project)\b/i.test(body);
  const opening = body.split(/[.!?\n]/)[0]?.trim() || "";
  const shortOpening = opening.split(/\s+/).length <= 24;
  const duration = seconds === null || seconds === "" ? null : Number(seconds);
  const supportedFormat = ["post", "short-video", "campaign-video", "audio"].includes(format);
  const signals = [
    { outcome: "Initial attention", observed: body.length > 0 && shortOpening ? "Clear short opening is present" : "Opening needs visual/wording review", limitation: "First-frame gaze, feed visibility and viewer behavior are not measured", evidence: "2025 viewport/eye-tracking attention validation" },
    { outcome: "Continued attention", observed: Number.isFinite(duration) && duration > 0 ? "Duration supplied: " + duration + " seconds" : "Duration and scene-level pacing unknown", limitation: "View retention, cuts and real watch-time must be measured", evidence: "2025 visual complexity and scene-cut study" },
    { outcome: "Delayed recall", observed: hasSpecifics ? "Some concrete context identified" : "Concrete message details may need strengthening", limitation: "Recall cannot be inferred from wording; delayed unaided recall testing is required", evidence: "WACV 2025 ad memorability research" },
    { outcome: "Willingness to engage", observed: hasAction ? "Explicit next-step wording detected" : "An intelligible next action is not detected", limitation: "Real clicks, saves, comments and shares need separate observed denominators", evidence: "2024 context-aware engagement modeling" },
    { outcome: "Emotional resonance & trust", observed: words > 0 ? "Draft available for review" : "No content supplied", limitation: "Audience-specific response, truthfulness and prior experience are not yet evaluated", evidence: "Audio-visual dual-process advertising research" },
    { outcome: "Audio and sound design", observed: audio ? (captions ? "Audio and captions indicated" : "Audio indicated; captions not confirmed") : "Audio not supplied", limitation: "Waveform, spectrum, dialogue clarity and effect placement require actual audio analysis; Hz alone cannot predict emotional response", evidence: "Audio-visual cue and attention studies" },
  ];
  return {
    mode: "research-informed / uncalibrated",
    calibrated: false,
    probabilities: null,
    audience: String(audience).trim() || "Not specified",
    format: supportedFormat ? format : "post",
    signals,
    missing: [
      "Segment-level media features and playback environment",
      "Intended audience relevance and actual exposure counts",
      "Observed delayed recall and consented engagement labels",
      "Held-out outcome-specific calibration and confidence intervals",
    ],
  };
}
