/**
 * Identify measured changes in video frames. This is a sampled pixel-change
 * metric, not a direct measure of emotion, attention, recall or "optimal" timing.
 */
export function estimateVisualTransitions(frames) {
  if (!Array.isArray(frames) || frames.length < 2) return [];
  const transitions = [];
  for (let i = 1; i < frames.length; i++) {
    const previous = frames[i - 1], current = frames[i];
    const a = previous?.bins, b = current?.bins;
    if (!(a instanceof Float64Array) || !(b instanceof Float64Array) || a.length !== b.length || !a.length)
      throw new Error("Frame histogram measurements are incomplete.");
    const time = Number(current.time);
    if (!Number.isFinite(time) || time <= Number(previous.time)) throw new Error("Video timestamps must increase.");
    let difference = 0;
    for (let j = 0; j < a.length; j++) difference += Math.abs(a[j] - b[j]);
    // Each normalized histogram sums to 1. Total variation belongs to [0,1].
    transitions.push({ at: Number(time.toFixed(2)), change: Number(Math.min(1, difference / 2).toFixed(4)) });
  }
  return transitions;
}
export function histogramFromRgba(bytes, bins = 16) {
  if (!(bytes instanceof Uint8ClampedArray) || bytes.length % 4 !== 0 || bytes.length === 0)
    throw new Error("RGBA frame pixels required.");
  const histogram = new Float64Array(bins);
  for (let i = 0; i < bytes.length; i += 4) {
    // Approximate luminance; ignore alpha for video frames.
    const lum = 0.2126 * bytes[i] + 0.7152 * bytes[i + 1] + 0.0722 * bytes[i + 2];
    histogram[Math.min(bins - 1, Math.floor(lum / 256 * bins))]++;
  }
  const pixelCount = bytes.length / 4;
  for (let i = 0; i < bins; i++) histogram[i] /= pixelCount;
  return histogram;
}
export function chooseVisualCue(transitions, minTime, maxTime, fallback) {
  const qualifying = transitions.filter(t => Number.isFinite(t.at) && Number.isFinite(t.change) &&
    t.at >= minTime && t.at <= maxTime);
  if (!qualifying.length) return null;
  const ranked = [...qualifying].sort((a, b) => b.change - a.change || Math.abs(a.at-fallback)-Math.abs(b.at-fallback));
  return ranked[0];
}
