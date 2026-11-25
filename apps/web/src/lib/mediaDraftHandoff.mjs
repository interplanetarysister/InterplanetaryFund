// In-memory, same-tab handoff for generated media. Never persisted to URL,
// localStorage, database or server. A draft is bound to a verified owner.
let pending = null;
export function stageMediaForOptimization(file, ownerId) {
  if (!(file instanceof Blob) || !ownerId || file.size > 50 * 1024 * 1024 ||
      !String(file.type).startsWith("image/"))
    throw new Error("A valid owner-scoped image is required.");
  pending = { file, ownerId, expiresAt: Date.now() + 10 * 60 * 1000 };
}
export function consumeMediaForOptimization(ownerId) {
  const draft = pending;
  pending = null;
  if (!draft || !ownerId || draft.ownerId !== ownerId || Date.now() > draft.expiresAt) return null;
  return draft.file;
}
export function clearMediaOptimizationDraft() { pending = null; }

let audioPending = null;
export function stageAudioForMediaOptimization(blob, ownerId) {
  if (!(blob instanceof Blob) || !ownerId || blob.size <= 0 ||
    blob.size > 38 * 1024 * 1024 || !blob.type.startsWith("audio/"))
    throw new Error("A valid owner-scoped audio mix is required.");
  audioPending = { blob, ownerId, expiresAt: Date.now() + 10 * 60 * 1000 };
}
export function consumeAudioForMediaOptimization(ownerId) {
  const saved = audioPending;
  audioPending = null;
  if (!saved || !ownerId || saved.ownerId !== ownerId || Date.now() > saved.expiresAt) return null;
  return saved.blob;
}
export function clearAudioOptimizationDraft() { audioPending = null; }
