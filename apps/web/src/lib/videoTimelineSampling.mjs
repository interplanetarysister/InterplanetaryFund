import { estimateVisualTransitions, histogramFromRgba } from "./mediaVisualMetrics.mjs";

function awaitEvent(target, name, signal, milliseconds = 7000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      target.removeEventListener(name, done);
      target.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
      clearTimeout(timer);
    };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Video could not be decoded.")); };
    const abort = () => { cleanup(); reject(new Error("Video inspection cancelled.")); };
    target.addEventListener(name, done, { once: true });
    target.addEventListener("error", fail, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error("Video frame inspection timed out.")); }, milliseconds);
    if (signal?.aborted) abort();
  });
}
export async function sampleLocalVideoFrames(fileUrl, { signal, maxFrames = 48 } = {}) {
  if (typeof fileUrl !== "string" || !fileUrl.startsWith("blob:"))
    throw new Error("Only local media previews can be sampled.");
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = fileUrl;
  const canvas = document.createElement("canvas");
  canvas.width = 96; canvas.height = 54;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Frame sampling is not supported by this browser.");
  try {
    if (video.readyState < 1) await awaitEvent(video, "loadedmetadata", signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration < 1 || duration > 600)
      throw new Error("Video frame analysis supports clips between 1 and 600 seconds.");
    const count = Math.max(2, Math.min(48, Math.trunc(maxFrames), Math.ceil(duration / 0.5)));
    const samples = [];
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new Error("Video inspection cancelled.");
      const time = Math.max(0, Math.min(duration - 0.04, (i / (count - 1)) * Math.max(0.04,duration - 0.04)));
      if (Math.abs(video.currentTime - time) > 0.01 || video.readyState < 2) {
        const ready = awaitEvent(video, "seeked", signal);
        video.currentTime = time;
        await ready;
      }
      if (signal?.aborted) throw new Error("Video inspection cancelled.");
      ctx.drawImage(video, 0, 0, 96, 54);
      const bins = histogramFromRgba(ctx.getImageData(0, 0, 96, 54).data);
      samples.push({time, bins});
    }
    return { transitions: estimateVisualTransitions(samples), sampledFrames: samples.length, duration,
      caveat: "Sampled low-resolution frame-histogram changes only. Motion within a scene and speech peaks may be missed. Large transitions can be ordinary cuts rather than important narrative moments." };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
