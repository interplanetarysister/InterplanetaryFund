// Campaign donations are paused on the live platform ("CAMPAIGN DONATIONS ARE
// CURRENTLY PAUSED"). The former backend flag is not part of this
// independent app, so this hook fails closed: campaign checkout
// stays disabled until a Supabase-backed fundraising-mode flag is ported.
export function usePublicCampaignFundraising() {
  return false;
}
