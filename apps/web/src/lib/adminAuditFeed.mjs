/**
 * Strict parsing for the verified, deliberately restricted operations audit RPC.
 * These events are selected operational records, not a universal audit log.
 */
export const AUDIT_PAGE_SIZE = 50;
const SOURCES = Object.freeze({
  "workflow": "workflow:",
  "administrative mail": "mail:",
  "platform incident": "incident:",
});
export function validateAuditRows(data) {
  if (!Array.isArray(data) || data.length > AUDIT_PAGE_SIZE)
    throw new Error("The audit feed returned an unexpected page.");
  const seen = new Set();
  let preceding = null;
  return data.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        typeof row.event_id !== "string" || row.event_id.length > 160 ||
        typeof row.event_source !== "string" ||
        !Object.prototype.hasOwnProperty.call(SOURCES, row.event_source) ||
        !row.event_id.startsWith(SOURCES[row.event_source]) ||
        row.event_id.length <= SOURCES[row.event_source].length ||
        typeof row.event_name !== "string" || row.event_name.length > 80 ||
        typeof row.occurred_at !== "string") {
      throw new Error("The audit feed contained an invalid record.");
    }
    const timestamp = Date.parse(row.occurred_at);
    if (!Number.isFinite(timestamp) || seen.has(row.event_id))
      throw new Error("The audit feed contained a duplicate or invalid timestamp.");
    const order = { timestamp, id: row.event_id };
    if (preceding &&
       (order.timestamp > preceding.timestamp ||
        (order.timestamp === preceding.timestamp && order.id > preceding.id)))
      throw new Error("The audit feed was returned out of order.");
    preceding = order;
    seen.add(row.event_id);
    return {
      event_id: row.event_id,
      event_source: row.event_source,
      event_name: row.event_name,
      occurred_at: row.occurred_at,
    };
  });
}
export function auditCursor(rows) {
  const last = rows?.at(-1);
  return last ? { p_before_at: last.occurred_at, p_before_id: last.event_id } :
    { p_before_at: null, p_before_id: null };
}
