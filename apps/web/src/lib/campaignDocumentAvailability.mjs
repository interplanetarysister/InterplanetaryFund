// Temporary fail-closed release gate. The legacy browser implementation uses
// Supabase Storage, while production private campaign documents are R2-backed.
// No browser environment variable may enable these controls until authenticated
// R2 endpoints, owner/campaign checks, and two-owner object-absence acceptance
// are implemented and independently verified. Preserve existing UI for migration.
export const CAMPAIGN_DOCUMENTS_ACTIVE = false;
