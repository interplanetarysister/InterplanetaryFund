// SCOUT research registry. These are integration candidates, NOT IFund partners
// or member earning offers. Approval and provider terms must be checked separately.
export const SCOUT_RESEARCH_VERSION = "2026-11-20";
export const SCOUT_PROVIDERS = Object.freeze([
  Object.freeze({
    id:"adgem",name:"AdGem",kind:"rewarded_offers",
    official_url:"https://docs.adgem.com/docs/get-started",
    integration_url:"https://docs.adgem.com/docs/reference/offer-api/offer-api",
    evidence:"Publisher API and server-to-server completion postbacks",
    eligibility:"Publisher approval, inventory/traffic review and authorized incentive terms required",
    state:"research_only",reward_state:"not_enabled",partner_verified:false
  }),
  Object.freeze({
    id:"ayet",name:"ayeT-Studios",kind:"rewarded_offers",
    official_url:"https://docs.ayetstudios.com/v/product-docs/offerwall/web-integrations/web-offerwall",
    integration_url:"https://docs.ayetstudios.com/v/product-docs/offerwall/api-integrations/offerwall-api",
    evidence:"Publisher offerwall and API integration documentation",
    eligibility:"Publisher approval and offer-specific qualification required",
    state:"research_only",reward_state:"not_enabled",partner_verified:false
  }),
  Object.freeze({
    id:"awin",name:"Awin",kind:"affiliate",
    official_url:"https://www.awin.com/us",
    integration_url:"https://www.awin.com/us/faqs",
    evidence:"Advertiser and publisher affiliate programs",
    eligibility:"Publisher and advertiser program approval; incentive rewards only if explicitly permitted",
    state:"research_only",reward_state:"not_enabled",partner_verified:false
  }),
]);
export const SCOUT_POLICY = Object.freeze({
  research_only:true,member_enrollment_enabled:false,sponsor_posting_enabled:false,
  payout_enabled:false,provider_postbacks_enabled:false,
  no_guaranteed_income:true,verified_partnerships:0,
  owner_approval_for_external_actions:true
});
export function scoutProvider(id) { return SCOUT_PROVIDERS.find(x=>x.id===id) || null; }
export function safeScoutUrl(input) {
  try { const u=new URL(input);return u.protocol==="https:"&&!u.username&&!u.password; }
  catch { return false; }
}
