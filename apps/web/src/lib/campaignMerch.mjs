/**
 * iFund managed merchandise contract.
 * No checkout, Printful order, or financial transfer is performed here.
 * The module is shared by the creator UI and finance review.
 */
export const MERCH_DESIGN_OPTIONS = Object.freeze([
  Object.freeze({
    id: "orbit-portrait",
    label: "Orbit Portrait",
    description: "Feature the campaign artwork inside a luminous orbital frame, with the beneficiary's approved name below.",
    accent: "#45e5e9",
  }),
  Object.freeze({
    id: "horizon-story",
    label: "Horizon Story",
    description: "Pair the campaign photograph with a cosmic horizon and a personalized beneficiary name.",
    accent: "#bc84ff",
  }),
  Object.freeze({
    id: "mission-emblem",
    label: "Mission Emblem",
    description: "A bold, legible mission badge shaped by the campaign imagery and the beneficiary's name.",
    accent: "#9bec80",
  }),
]);
export const MERCH_AGENT_RESPONSIBILITIES = Object.freeze({
  nexus: "Coordinates the owner-approved merchandise workflow; never places orders.",
  link: "Maintains Printful connection health, scopes, catalog mappings, and vendor status; never exposes credentials.",
  story: "Proposes three faithful art directions from owner-authorized campaign imagery and approved beneficiary wording.",
  forge: "Reviews merchandising presentation and experiments without claiming unverified conversions.",
  orbit: "Reconciles verified costs and the 50/50 positive net-profit allocation; never uses estimated sales as campaign funds.",
  echo: "Drafts optional campaign-shop announcements; external posting requires separate authorization.",
});
export const MAX_BENEFICIARY_NAME_LENGTH = 72;
const MONEY_FIELDS = Object.freeze([
  "saleSubtotalCents", "productionCents", "sellerPaidShippingCents",
  "paymentProcessingCents", "sellerPaidTaxCents", "refundsCents",
  "approvedOtherDirectCostsCents",
]);
export function publicBeneficiaryLabel(name) {
  if (typeof name !== "string") return "";
  return name.normalize("NFKC")
    .replace(/[\\u0000-\\u001f\\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\\s+/g, " ").trim().slice(0, MAX_BENEFICIARY_NAME_LENGTH);
}
export function validateMerchDesignRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false, error: "Choose a campaign and an authorized design." };
  const beneficiaryName = publicBeneficiaryLabel(input.beneficiaryName);
  if (!beneficiaryName) return { ok: false, error: "Enter the beneficiary name you have permission to print." };
  if (input.namePublicationApproved !== true)
    return { ok: false, error: "Confirm permission to print the beneficiary's name." };
  if (input.artworkRightsConfirmed !== true)
    return { ok: false, error: "Confirm that you may use the campaign artwork for merchandise." };
  if (!MERCH_DESIGN_OPTIONS.some(option => option.id === input.designId))
    return { ok: false, error: "Select one of the three available designs." };
  return { ok: true, beneficiaryName, designId: input.designId };
}
/**
 * Gross merchandise subtotal excludes buyer-paid tax and buyer-paid shipping.
 * Never add donation amounts or unrelated platform fees to this calculation.
 * Never book projected, unsettled, refunded or disputed sales as earnings.
 */
export function calculateVerifiedMerchSplit(inputs) {
  if (!inputs || typeof inputs !== "object") throw new TypeError("Verified order accounting is required.");
  const money = {};
  for (const field of MONEY_FIELDS) {
    const value = inputs[field] ?? 0;
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError(field + " must be a nonnegative integer number of cents.");
    money[field] = value;
  }
  if (inputs.providerSettled !== true || inputs.orderFulfilled !== true ||
      inputs.refundWindowClosed !== true || inputs.hasOpenDispute === true)
    return Object.freeze({ eligible: false, campaignCents: 0, platformCents: 0, netProfitCents: 0, reason: "Order is not cleared for profit distribution." });
  const directCosts = MONEY_FIELDS.filter(field => field !== "saleSubtotalCents")
    .reduce((total, field) => total + money[field], 0);
  const netProfit = Math.max(0, money.saleSubtotalCents - directCosts);
  if (!Number.isSafeInteger(directCosts) || !Number.isSafeInteger(netProfit))
    throw new RangeError("Order value exceeds safe accounting limits.");
  // Allocate a rounding penny to the campaign, never to iFund.
  const campaignCents = Math.ceil(netProfit / 2);
  return Object.freeze({
    eligible: true, netProfitCents: netProfit, directCostCents: directCosts,
    campaignCents, platformCents: netProfit - campaignCents,
  });
}
export function describeMerchArtwork({ campaignTitle, campaignSummary, beneficiaryName, designId }) {
  const option = MERCH_DESIGN_OPTIONS.find(item => item.id === designId);
  if (!option) throw new RangeError("Unknown merchandise design.");
  const title = String(campaignTitle ?? "").trim().slice(0, 150);
  const summary = String(campaignSummary ?? "").trim().slice(0, 550);
  const name = publicBeneficiaryLabel(beneficiaryName);
  if (!name) throw new RangeError("An approved beneficiary name is required.");
  return [
    "Create original print-on-demand art for an iFund campaign item.",
    "Visual composition:", option.description,
    "Campaign purpose:", title || "Campaign", summary,
    "Text to print exactly:", name,
    "Treat submitted campaign artwork as a reference only when explicit rights are confirmed.",
    "Do not invent real events, portraits, logos, endorsements, financial claims, or extra beneficiary names.",
    "Return a proof for human approval; never create an order or publish the art automatically.",
  ].join("\\n");
}
