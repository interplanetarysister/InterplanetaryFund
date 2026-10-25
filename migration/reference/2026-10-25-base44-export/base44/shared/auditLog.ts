// Lightweight audit-logging helper. Writes an AuditLog record via the service
// role so it works from any backend function. Failures are logged but never
// thrown — audit logging must not break the calling operation.
const SECRET_KEY = /(password|secret|token|cookie|authorization|credential|mfa|recovery|private[_-]?key|client[_-]?secret)/i;

function scrubMetadata(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 1000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => scrubMetadata(item, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, 1000);

  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (SECRET_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = scrubMetadata(item, depth + 1);
  }
  return out;
}

export async function logAudit(base44, entry) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      action: String(entry.action || 'unknown').slice(0, 160),
      actor_user_id: String(entry.actor_user_id || '').slice(0, 200),
      target_type: String(entry.target_type || '').slice(0, 160),
      target_id: String(entry.target_id || '').slice(0, 240),
      detail: String(entry.detail || '').slice(0, 2000),
      status: ['success', 'failure', 'in_progress'].includes(entry.status) ? entry.status : 'success',
      metadata: scrubMetadata(entry.metadata || {}),
    });
  } catch (e) {
    console.error('logAudit failed:', e?.name || 'UnknownError');
  }
}