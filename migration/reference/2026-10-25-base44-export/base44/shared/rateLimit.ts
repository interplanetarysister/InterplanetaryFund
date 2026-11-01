// Persistent fixed-window rate limiter backed by the RateLimitBucket entity.
// Service-scoped (writes/reads via base44.asServiceRole) so it works from any
// backend function. Returns { allowed, remaining, retryAfterSeconds }.
// Use a stable key that identifies the actor + action, e.g.
// `sendCommunication:<userId>`. Fails OPEN: a limiter outage never blocks a
// legitimate request.
export async function checkRateLimit(base44, key, max, windowSeconds) {
  try {
    const sr = base44.asServiceRole;
    const now = Date.now();
    const existing = await sr.entities.RateLimitBucket.filter({ key }, '-created_date', 1);
    const bucket = existing && existing[0];
    const windowStartMs = bucket ? new Date(bucket.window_start).getTime() : 0;
    const expired = !bucket || windowStartMs + windowSeconds * 1000 <= now;

    if (expired) {
      const data = { key, window_start: new Date(now).toISOString(), count: 1 };
      if (bucket) {
        await sr.entities.RateLimitBucket.update(bucket.id, data);
      } else {
        await sr.entities.RateLimitBucket.create(data);
      }
      return { allowed: true, remaining: Math.max(0, max - 1), retryAfterSeconds: 0 };
    }

    if (bucket.count < max) {
      await sr.entities.RateLimitBucket.updateMany({ id: bucket.id }, { $inc: { count: 1 } });
      return { allowed: true, remaining: Math.max(0, max - bucket.count - 1), retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowSeconds * 1000 - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  } catch (e) {
    console.error('checkRateLimit failed (failing open):', e && e.message ? e.message : e);
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
  }
}