import { chooseVisualCue } from "./mediaVisualMetrics.mjs";

/**
 * Editing recipes never overwrite an uploaded file. Suggested cue windows are
 * storyboarding hypotheses, not validated engagement maxima or probability
 * predictions. Platform frame sizes are editable starting presets.
 */
export const PLATFORM_FRAMES = Object.freeze({
  ifund: { name: "iFund campaign", width: 1200, height: 675, placement: "Campaign cover", cueWindow: [0.3, 0.62] },
  "instagram-reels": { name: "Instagram Reels", width: 1080, height: 1920, placement: "Vertical short-form", cueWindow: [0.22, 0.52] },
  "facebook-reels": { name: "Facebook Reels", width: 1080, height: 1920, placement: "Vertical short-form", cueWindow: [0.22, 0.52] },
  tiktok: { name: "TikTok", width: 1080, height: 1920, placement: "Vertical short-form", cueWindow: [0.2, 0.5] },
  "youtube-shorts": { name: "YouTube Shorts", width: 1080, height: 1920, placement: "Vertical short-form", cueWindow: [0.22, 0.55] },
  "instagram-feed": { name: "Instagram Feed", width: 1080, height: 1350, placement: "Portrait feed", cueWindow: [0.32, 0.67] },
  "facebook-feed": { name: "Facebook Feed", width: 1200, height: 630, placement: "Landscape feed", cueWindow: [0.3, 0.65] },
});

export const clampUnit = n => Math.max(0, Math.min(1, Number.isFinite(Number(n)) ? Number(n) : 0));

export function proposeInterestCue({ duration, platformId, audioWindows = [], visualTransitions = [], preferredTime = null } = {}) {
  const seconds = Number(duration);
  const frame = PLATFORM_FRAMES[platformId];
  if (!frame) throw new Error("Unknown platform");
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  // No empirical timing optimum is implied by these intervals.
  const [a, b] = frame.cueWindow;
  const start = Number((seconds * a).toFixed(1));
  const end = Number((seconds * b).toFixed(1));
  const target = Number((seconds * ((a + b) / 2)).toFixed(1));
  const preferred = preferredTime == null ? null : Number(preferredTime);
  const inRange = Number.isFinite(preferred) && preferred >= 0 && preferred <= seconds;
  const candidates = audioWindows
    .filter(w => Number.isFinite(w?.from) && Number.isFinite(w?.rms) && w.from >= start && w.from <= end)
    .sort((x, y) => Math.abs(x.from - target) - Math.abs(y.from - target));
  const visual = chooseVisualCue(visualTransitions, start, end, target);
  const measuredVisualCue = visual && visual.change >= 0.15 ? visual : null;
  const anchor = inRange ? preferred : measuredVisualCue ? measuredVisualCue.at : (candidates.length ? candidates[0].from : target);
  return {
    suggestedAt: Number(anchor.toFixed(1)),
    windowStart: start,
    windowEnd: end,
    duration: seconds,
    basis: inRange ? "creator-selected timing" : measuredVisualCue ? "measured visual frame transition near storyboard cue window" : candidates.length ? "nearest measured audio window within a storyboard interval" : "editable storyboard interval",
    validatedOptimum: false,
    note: "Place a meaningful reveal, turning point or interest peak here only if it fits the story. Timing is a planning hypothesis—not a proven platform-specific attention optimum.",
  };
}

export function createPlatformVariants(ids, existing = {}) {
  return [...new Set(ids)].filter(id => PLATFORM_FRAMES[id]).map(id => {
    const base = existing[id] || {};
    return {
      id,
      width: PLATFORM_FRAMES[id].width,
      height: PLATFORM_FRAMES[id].height,
      focalX: clampUnit(base.focalX ?? 0.5),
      focalY: clampUnit(base.focalY ?? 0.5),
      scale: Math.max(1, Math.min(2, Number(base.scale) || 1)),
      cueTime: base.cueTime == null ? null : Number(base.cueTime),
      caption: typeof base.caption === "string" ? base.caption.slice(0, 6000) : "",
      brightness: Math.max(0.5,Math.min(1.5,Number(base.brightness)||1)),
      contrast: Math.max(0.5,Math.min(1.5,Number(base.contrast)||1)),
      saturation: Math.max(0,Math.min(2,base.saturation == null ? 1 : Number(base.saturation))),
      videoSpeed: Math.max(0.5,Math.min(2,Number(base.videoSpeed)||1)),
      videoVolume: Math.max(0,Math.min(1,base.videoVolume == null ? 1 : Number(base.videoVolume))),
      trimStart: Math.max(0,Number(base.trimStart)||0),
      trimEnd: Math.max(0,Number(base.trimEnd)||0),
      showSafeZone: base.showSafeZone===true,
      source: "original",
    };
  });
}

export function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight, focalX = 0.5, focalY = 0.5, scale = 1) {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(n => Number.isFinite(n) && n > 0))
    throw new Error("Valid media dimensions required");
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const cropWidth = sourceRatio > targetRatio ? sourceHeight * targetRatio / scale : sourceWidth / scale;
  const cropHeight = sourceRatio > targetRatio ? sourceHeight / scale : sourceWidth / targetRatio / scale;
  const x = clampUnit(focalX) * Math.max(0, sourceWidth - cropWidth);
  const y = clampUnit(focalY) * Math.max(0, sourceHeight - cropHeight);
  return { x, y, width: cropWidth, height: cropHeight };
}
