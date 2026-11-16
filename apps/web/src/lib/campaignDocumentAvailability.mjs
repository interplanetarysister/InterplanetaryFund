// Client build flag and server feature flag are deliberately separate.
// Do not expose private document uploads until the real Supabase bucket/table,
// RLS, and two-owner acceptance checks are complete.
export const CAMPAIGN_DOCUMENTS_ACTIVE =
  import.meta.env.VITE_IFUND_CAMPAIGN_DOCUMENTS_ENABLED === "enabled";
