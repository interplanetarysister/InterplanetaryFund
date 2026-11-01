// Browser-safe input contract for the verified public publication RPC.
// The original Base44 entity IDs are text (typically 24 characters), not UUIDs.
export const EDITORIAL_REF = /^[A-Za-z0-9_-]{1,128}$/;
export function validEditorialRef(value) {
  return typeof value === "string" && EDITORIAL_REF.test(value);
}
export function limitEditorialResults(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(100, Math.max(1, Math.floor(count))) : 100;
}
export function verifiedPublishedEntries(rows) {
  if (!Array.isArray(rows) || rows.length > 100) throw new Error("Invalid public story response.");
  return rows.filter(row => row && validEditorialRef(row.id) &&
    row.status === "published" && row.blog?.status === "active" &&
    typeof row.title === "string" && typeof row.body === "string");
}
export function verifiedPublications(rows) {
  if (!Array.isArray(rows) || rows.length > 100) throw new Error("Invalid publication response.");
  return rows.filter(row => row && validEditorialRef(row.id) &&
    row.status === "published" && row.final_approved === true);
}
