// Campaign donations are paused on the live platform ("CAMPAIGN DONATIONS ARE
// CURRENTLY PAUSED"). The Base44 backend that published this flag is not used
// by the standalone public site, so this hook fails closed: campaign checkout
// stays disabled until a Supabase-backed fundraising-mode flag is ported.
export function usePublicCampaignFundraising() {
  return false;
}
