// Private campaign document bytes live in Cloudflare R2, not Supabase Storage.
// The legacy browser adapter still targets a nonexistent Supabase bucket.
// Fail closed regardless of public build flags until the owner-scoped same-origin
// R2 service has verified receipts, identity-serialized deletion, and two-owner QA.
// Do not change this to an environment-only toggle: a stale or mistakenly
// enabled build flag must never activate the legacy storage adapter.
export const CAMPAIGN_DOCUMENTS_ACTIVE = false;
