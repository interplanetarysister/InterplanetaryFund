// Sprint 7 (2026-11-25): pure helpers for the standalone Donate / Checkout
// page (40-page list, page 31). No DOM, no network, no fabricated results:
// the campaign id from ?campaign= is passed through untouched to
// getCampaignDetail, which returns null for unknown, inactive or non-UUID
// ids — the page then renders a not-found state instead of inventing a
// campaign. Platform support (?support=1, or no campaign) never carries a
// campaign identifier, exactly as PlatformSupportDonationDialog requires.
export const DONATE_TABS = Object.freeze([
  { id: "donate", label: "Donate" },
  { id: "invest", label: "Invest" },
]);

// Tab state lives in the URL (?tab=invest) so tabs are deep-linkable.
// Unknown or missing values fall back to Donate.
export function tabFromParam(value) {
  const found = DONATE_TABS.find((tab) => tab.id === String(value || "").toLowerCase());
  return found ? found.id : "donate";
}

// Campaign mode wins only when a non-empty ?campaign= value is present;
// ?support=1 (or no campaign) is platform support. The id is never
// invented, normalised or defaulted here — resolution happens in the page
// through the real public campaign read.
export function donateModeFromParams(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || "");
  const campaignId = (params.get("campaign") || "").trim();
  if (campaignId) return { mode: "campaign", campaignId };
  return { mode: "support", campaignId: null };
}
