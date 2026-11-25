/** Measured acoustic descriptors, not inferred emotions or calibrated listener response. */
export function analyzeAudioSamples(channels, sampleRate) {
  if (!Array.isArray(channels) || channels.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error("Valid decoded audio is required.");
  const length = channels[0]?.length || 0;
  if (length < 1 || channels.some(channel => channel.length !== length))
    throw new Error("Audio channels must have matching nonempty samples.");
  const stride = Math.max(1, Math.floor(sampleRate / 250));
  let sum = 0, count = 0, max = 0, clipped = 0, previous = 0, crossings = 0;
  const windows = [];
  const windowSize = Math.max(1, Math.floor(sampleRate / 2));
  for (let offset = 0; offset < length; offset += windowSize) {
    const end = Math.min(length, offset + windowSize);
    let localSum = 0, localCount = 0;
    for (let i = offset; i < end; i += stride) {
      let value = 0;
      for (const channel of channels) value += channel[i];
      value /= channels.length;
      if (!Number.isFinite(value)) throw new Error("Audio samples contain invalid values.");
      const abs = Math.abs(value);
      max = Math.max(max, abs);
      if (abs >= 0.999) clipped++;
      if (count > 0 && value * previous < 0) crossings++;
      previous = value;
      sum += value * value; count++;
      localSum += value * value; localCount++;
    }
    const rms = Math.sqrt(localSum / Math.max(1, localCount));
    windows.push({ from: Number((offset / sampleRate).toFixed(2)), to: Number((end / sampleRate).toFixed(2)), rms: Number(rms.toFixed(5)), quiet: rms < 0.015 });
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  const quietSeconds = windows.filter(w => w.quiet).reduce((s, w) => s + w.to - w.from, 0);
  return {
    durationSeconds: Number((length / sampleRate).toFixed(2)),
    peak: Number(max.toFixed(4)),
    rms: Number(rms.toFixed(4)),
    clippedSampleFraction: Number((clipped / Math.max(1, count)).toFixed(5)),
    quietSeconds: Number(quietSeconds.toFixed(2)),
    zeroCrossingRatePerSecond: Number((crossings / (length / sampleRate)).toFixed(1)),
    windows,
    limitations: "Approximate sampled descriptors. Zero-crossing rate is not a validated measure of emotion or pitch. Quiet sections may be intentional; signal peak clipping does not detect every form of distortion.",
  };
}
