/**
 * Bound request-body consumption independently of Content-Length. Clients can
 * omit or lie about that header, so request.text() is unsafe for edge handlers.
 */
export class BodyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readJsonBody(request, byteLimit) {
  const mime = request.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|\s*$)/i.test(mime)) {
    throw new BodyError(415, 'JSON request body required.');
  }
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > byteLimit)) {
    throw new BodyError(413, 'Request too large.');
  }
  if (!request.body) throw new BodyError(400, 'Invalid JSON.');
  const reader = request.body.getReader();
  const parts = [];
  let used = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new BodyError(400, 'Invalid JSON.');
      used += value.byteLength;
      if (used > byteLimit) {
        await reader.cancel().catch(() => {});
        throw new BodyError(413, 'Request too large.');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(used);
  let offset = 0;
  for (const chunk of parts) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let raw;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(merged);
    return JSON.parse(raw);
  } catch {
    throw new BodyError(400, 'Invalid JSON.');
  }
}
