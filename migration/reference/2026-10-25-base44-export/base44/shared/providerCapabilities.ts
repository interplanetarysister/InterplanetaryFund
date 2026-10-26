// Canonical provider-capability registry. ONE source of truth for what each
// fundraising platform can do, consumed by both the UI (listFundraising-
// ProviderCapabilities) and financial execution (prepare/executeCollectAndWithdraw).
//
// The SEED below describes the current IFund runtime capability baseline, not
// theoretical provider features. A capability is true only when the authoritative
// Base44 build currently has a provider-backed implementation for it. Stored FundraisingProviderCapability
// records override/extend it. Unknown capability NEVER becomes verified
// capability — a platform missing from both SEED and storage resolves to a
// fail-closed observe_only/research_required entry.
// poll_support is research metadata about a provider's technical interface.
// It never authorizes IFund polling, scheduled work, page-load sync, or agents;
// external fundraising reads run only after an explicit authenticated request.

export const CAPABILITY_SEED = [
  { platform:'gofundme', display_name:'GoFundMe', category:'crowdfunding', domain:'https://gofundme.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:true, capability_status:'verified', implementation_status:'implemented', test_status:'passing', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer','withdrawal_initiation'], manual_required_actions:['bank_transfer_setup','identity_verification'], evidence_url:'https://support.gofundme.com/hc/en-us/articles/360041758152-Transfer-to-a-business-or-organization', notes:'GoFundMe supports recipient/business bank transfer setup, but recipient/decision-maker verification remains provider-controlled. IFund must not represent this as an API-initiated payout.' },
  { platform:'kickstarter', display_name:'Kickstarter', category:'crowdfunding', domain:'https://kickstarter.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:true, capability_status:'research_required', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer','withdrawal_initiation'], manual_required_actions:['bank_transfer','identity_verification'], notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'indiegogo', display_name:'Indiegogo', category:'crowdfunding', domain:'https://indiegogo.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:true, capability_status:'research_required', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer','withdrawal_initiation'], manual_required_actions:['bank_transfer','identity_verification'], notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'fundrazr', display_name:'FundRazr', category:'crowdfunding', domain:'https://fundrazr.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:true, poll_support:true, capability_status:'partial', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer'], manual_required_actions:['stripe_account_setup'], notes:'Stripe-based routing is a candidate; verify the specific campaign/payment configuration before presenting as automatic.' },
  { platform:'givesendgo', display_name:'GiveSendGo', category:'crowdfunding', domain:'https://givesendgo.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'automatic_payout', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:true, capability_status:'verified', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer'], manual_required_actions:['bank_account_verification'], evidence_url:'https://help.givesendgo.com/portal/en/kb/articles/how-transfers-work-on-givesendgo', notes:'GiveSendGo supports manual full-balance transfers and weekly, bi-weekly, or monthly automatic transfers to the verified recipient bank account.' },
  { platform:'kofi', display_name:'Ko-fi', category:'creator_support', domain:'https://ko-fi.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, connection_strategy:'webhook', webhook_support:true, poll_support:false, capability_status:'verified', implementation_status:'implemented', test_status:'passing', adapter_reference:'kofiWebhook', supported_actions:['campaign_import','webhook_events'], unsupported_actions:['api_transfer','withdrawal_initiation'], manual_required_actions:['paypal_or_stripe_setup'], evidence_url:'https://help.ko-fi.com/hc/en-us/articles/115003980093-How-do-I-get-paid', notes:'Payments route directly to the creator connected PayPal or Stripe account; there is no Ko-fi-held balance for IFund to withdraw.' },
  { platform:'buymeacoffee', display_name:'Buy Me a Coffee', category:'creator_support', domain:'https://buymeacoffee.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:true, poll_support:true, capability_status:'partial', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer'], manual_required_actions:['payout_account_setup'], notes:'Connected payout rail model; verify account-specific payout availability.' },
  { platform:'patreon', display_name:'Patreon', category:'creator_support', domain:'https://patreon.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'automatic_payout', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:true, capability_status:'verified', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer'], manual_required_actions:['payout_method_setup'], evidence_url:'https://support.patreon.com/hc/en-us/articles/208656246-How-payouts-work', notes:'Patreon supports manual payouts and monthly automatic payouts; payout-method changes can create a five-day hold. IFund should configure/observe this flow rather than claim an API transfer.' },
  { platform:'spotfund', display_name:'Spotfund', category:'crowdfunding', domain:'https://spotfund.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:true, capability_status:'research_required', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer','withdrawal_initiation'], manual_required_actions:['bank_transfer'], notes:'Campaign discovery is supported from approved public campaign pages; payout automation remains disabled until independently verified.' },
  { platform:'eventbrite', display_name:'Eventbrite', category:'event', domain:'https://eventbrite.com', campaign_import:true, campaign_sync:true, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:true, capability_status:'research_required', implementation_status:'in_progress', test_status:'untested', adapter_reference:'discoverExternalCampaignSnapshot', supported_actions:['campaign_import','campaign_sync'], unsupported_actions:['api_transfer','withdrawal_initiation'], manual_required_actions:['payout_setup'], notes:'Event fundraising activity may be connected, but payout collection remains disabled until provider capabilities are independently verified.' },
  { platform:'justgiving', display_name:'JustGiving', category:'crowdfunding', domain:'https://justgiving.com', campaign_import:false, campaign_sync:false, campaign_create_documented:true, campaign_create_verified:false, balance_read:false, payout_model:'observe_only', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, connection_strategy:'manual', webhook_support:false, poll_support:false, capability_status:'research_required', implementation_status:'not_started', test_status:'untested', supported_actions:[], unsupported_actions:['api_transfer','withdrawal_initiation','live_campaign_create'], manual_required_actions:['provider_developer_approval','fundraise_oauth_consent','eligible_charity'], evidence_url:'https://developer.justgiving.com/apidocs/oauth', notes:'JustGiving documents the fundraise OAuth scope for creating pages, but IFund has no approved developer credentials, account-scoped writer or successful sandbox publication. Charity eligibility and provider approval apply. Manual handoff only until tested.' },
  { platform:'custom', display_name:'Custom Campaign URL', category:'custom', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'observe_only', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, connection_strategy:'observe_only', webhook_support:false, poll_support:false, capability_status:'research_required', implementation_status:'implemented', test_status:'passing', supported_actions:[], unsupported_actions:['campaign_import','balance_read','api_transfer','withdrawal_initiation'], manual_required_actions:[], notes:'Observation/import only until a provider-specific adapter is verified.' },
];

export const REGISTRY_VERSION = '2026-10-v1';

// Runtime-backed direct publishing adapters that are safe to execute in the
// current Base44 build. Stored research rows may verify/test these adapters,
// but cannot manufacture a direct-publish implementation for another platform.
const DIRECT_PUBLISH_RUNTIME_PLATFORMS = new Set(['bluesky', 'linkedin']);

// Fail-closed fallback for any platform not present in the SEED or storage.
// Unknown capability must never be treated as verified.
const FALLBACK_CAPABILITY = {
  platform: '',
  display_name: '',
  campaign_import: false,
  campaign_sync: false,
  balance_read: false,
  payout_model: 'observe_only',
  payout_destination_configurable: false,
  api_transfer: false,
  authenticated_browser: false,
  capability_status: 'research_required',
  notes: 'Provider capability has not been registered; treated as unsupported.',
};

// Merges the SEED baseline with stored FundraisingProviderCapability records.
// Stored values override SEED defaults so admin edits are authoritative. A
// platform present only in storage (not in the SEED) is included as-is.
// Callers receive the same canonical interpretation the UI shows.
export async function resolveCapabilities(sr) {
  const stored = await sr.entities.FundraisingProviderCapability.list('display_name', 1000).catch(() => []);
  const map = new Map(CAPABILITY_SEED.map((x) => [x.platform, { ...x }]));
  for (const row of stored || []) {
    const seed = map.get(row.platform);
    const base = seed || { ...FALLBACK_CAPABILITY, platform: row.platform, display_name: row.display_name || row.platform };
    const merged = { ...base, ...row };

    // Stored research/admin rows may disable a runtime capability, but they
    // cannot manufacture an implementation that does not exist in this build.
    // Unknown platforms inherit the fail-closed false baseline.
    for (const key of ['campaign_import', 'campaign_sync', 'balance_read', 'api_transfer', 'authenticated_browser']) {
      merged[key] = Boolean(base[key]) && Boolean(merged[key]);
    }
    merged.direct_publish_verified = DIRECT_PUBLISH_RUNTIME_PLATFORMS.has(String(row.platform || '').toLowerCase()) && merged.direct_publish_verified === true;
    // Never let a stored research row invent a campaign-creation write adapter.
    merged.campaign_create_verified = false;
    map.set(row.platform, merged);
  }
  // Current runtime has no authorized external crowdfunding campaign writer,
  // even where the external provider documents an API.
  for (const capability of map.values()) capability.campaign_create_verified = false;
  return [...map.values()];
}

// Resolves a single platform's capability. Returns the fail-closed fallback
// when the platform is unknown to both SEED and storage.
export async function resolveCapabilityForPlatform(sr, platform) {
  const key = String(platform || '').toLowerCase();
  const all = await resolveCapabilities(sr);
  const found = all.find((c) => String(c.platform).toLowerCase() === key);
  if (found) return found;
  return { ...FALLBACK_CAPABILITY, platform: key, display_name: key };
}

// Builds a platform→capability lookup Map for batch financial consumers.
export async function resolveCapabilityMap(sr) {
  const all = await resolveCapabilities(sr);
  return new Map(all.map((c) => [String(c.platform).toLowerCase(), c]));
}