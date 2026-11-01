// IFund first-party device grant v1. Narrow permissions only: a device grant is
// NOT an IFund user session, an admin token, OAuth for outside platforms or OBO consent.
export const DEVICE_SCOPES = ['identity:read', 'campaigns:read'];
export const DEVICE_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const DEVICE_GRANT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const DEVICE_POLL_INTERVAL_SECONDS = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2,'0')).join('');
}
export function secretDeviceCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2,'0')).join('');
}
export function visibleUserCode(): string {
  const random = crypto.getRandomValues(new Uint8Array(10));
  const chars = Array.from(random, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return chars.slice(0,5) + '-' + chars.slice(5);
}
export function canonicalUserCode(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[-\s]/g,'');
}
export function validUserCode(code: string): boolean {
  return code.length === 10 && [...code].every((c) => CODE_ALPHABET.includes(c));
}
export async function deviceHash(code: string) {
  return sha256('ifund:device-code:v1:' + code);
}
export async function userCodeHash(code: string) {
  return sha256('ifund:user-code:v1:' + canonicalUserCode(code));
}
export async function accessTokenFor(deviceCode: string): Promise<string> {
  // A different bearer from the device code. Neither plaintext secret is
  // stored. Identical exchanges are safe/idempotent and cannot mint new tokens.
  return 'ifd_at_' + await sha256('ifund:access-token:v1:' + deviceCode);
}
export async function accessTokenHash(accessToken: string) {
  return sha256('ifund:access-hash:v1:' + accessToken);
}
export function approvedScopes(input: unknown): string[] {
  const requested = Array.isArray(input) ? input : ['identity:read'];
  const result = [...new Set(requested.map((v) => String(v)))];
  if (!result.length || result.length > DEVICE_SCOPES.length ||
      result.some((v) => !DEVICE_SCOPES.includes(v))) return [];
  return result;
}
export function ownerSafeGrant(row: any) {
  return {
    id: String(row.id || ''),
    device_label: String(row.device_label || 'Unnamed device'),
    client_id: String(row.client_id || ''),
    scopes: (row.scopes || []).filter((s: string) => DEVICE_SCOPES.includes(s)),
    state: row.state,
    approved_at: row.approved_at || null,
    grant_expires_at: row.grant_expires_at || null,
  };
}
// This limiter intentionally fails CLOSED if persistence becomes unavailable.
// Unlike normal UI requests, code guessing and anonymous pairing must never
// bypass limiting just because an entity service is down.
export async function requireStrictDeviceLimit(sr: any, key: string, limit: number, windowSeconds: number) {
  const rows = await sr.entities.RateLimitBucket.filter({key}, '-created_date', 2);
  if (rows.length > 1) throw new Error('Ambiguous device rate-limit record');
  const now = Date.now();
  const row = rows[0];
  if (!row || !Number.isFinite(Date.parse(row.window_start)) ||
      now - Date.parse(row.window_start) >= windowSeconds * 1000) {
    const data = {key,window_start:new Date(now).toISOString(),count:1};
    if (row) await sr.entities.RateLimitBucket.update(row.id,data);
    else await sr.entities.RateLimitBucket.create(data);
    return true;
  }
  if (Number(row.count) >= limit) return false;
  await sr.entities.RateLimitBucket.updateMany({id:row.id},{$inc:{count:1}});
  return true;
}
