// Private campaign documents now use the canonical, owner-scoped iFund R2
// API. The browser never writes directly to Supabase Storage or gets a public
// document URL. Production remains fail-closed at the endpoint if the R2
// binding, active account, current terms or backend object receipt is missing.
export const CAMPAIGN_DOCUMENTS_ACTIVE = true;
