# iFund Managed Shop — Printful integration contract (November 20, 2026)

**Implementation branch:** `feature/printful-merch-cosmic-ui-main-sync-20261120`
**Status:** isolated source implementation / provider connection NOT VERIFIED / no orders enabled.
**Owner:** Interplanetary Fund; no fundraising creator needs their own Printful account.
**Supplier:** Printful Manual Order / API store (official: https://help.printful.com/hc/en-us/articles/50262225690257-How-do-I-create-and-use-a-manual-order-API-store ).
**Canonical storefront:** interplanetaryfund.com only once commercially approved.

## User experience

1. Sign in to iFund and open an owned campaign's editor.
2. Choose "Design a campaign item" to enter the owner-checked Strategy studio. The existing campaign, original imagery, financial records and navigation remain unchanged.
3. Review exactly **three designs**: Orbit Portrait, Horizon Story, Mission Emblem. Each must reflect the campaign's original imagery; the owner may upload a different authorized source image.
4. Add the **approved beneficiary display name** to be printed on the item; require explicit rights and name-publication consent, including parent/guardian authorization where necessary. Never infer or print a minor's or private person's name from a confidential attachment.
5. Optional: explicitly request an AI interpretation of an uploaded, permitted source photo. Use the existing quota/owner-gated Cloudflare image-improve endpoint. Generated illustrations are labeled as such and are not represented as documentary evidence.
6. Download a design proof. This is not a Printful-ready mockup, customer listing, sale or merchandise shipment.
7. **Future provider-connected stage:** submit selected proof for product catalog/placement validation, quote/size/print spec, transparent proceeds disclosure, owner approval, iFund merchant approval and actual product publication. One active featured product per campaign.

## Ownership and agents

- **NEXUS:** routes the workflow; maintains single owner-scoped context; records approvals and failures.
- **LINK:** responsible for the Printful account connection, token health, catalog/store capability, token rotation, operational support, and maintenance audits. Must not log in without valid authorization, fabricate a merchant account, or expose API tokens.
- **STORY:** develops art directions and prompts using the campaign's approved visual source. The deterministic proof renderer can work without an AI request.
- **FORGE:** evaluates merchandise visual presentation and campaign promotion metrics, without inventing sales or conversion improvements.
- **ORBIT:** verifies merchant/provider receipts, production charges, taxes, refunds and the **50/50 positive net-profit distribution**. No shop amount is silently added to verified donation totals.
- **ECHO:** prepares optional shop announcements. External posts/messages require separate verified user permission.

The Agent 1, Agent 3, Agent 4 and Agent 5 existing scheduled workflows have additive assignments, without overwriting their historical duties. This document is a capability contract, not proof that autonomous agent maintenance is connected to a live Printful account.

## Merchant account prerequisites

The authenticated iFund owner must have an actual Printful account, ownership-verified business profile, a Manual Order/API store, private API token scoped to that store, actual Printful payment/billing authorization and accepted service terms. The signup email and store ID must be recorded **only after provider verification**. The tool environment has no connected Printful plugin, and no existing linked account was verified on November 20.

Once supplied through a secure secrets manager, configure server-only `PRINTFUL_API_TOKEN` and `PRINTFUL_STORE_ID` for the appropriate Worker scope. Never put these in `VITE_` variables, GitHub files, logs or public UI. The module `worker/printfulStore.js` performs a read-only `GET /stores/{id}` health check, never an order create/confirm call. Official API: https://developers.printful.com/docs/.

Printful **produces and ships** goods; it is not automatically iFund's merchant of record or retail payment processor. Before live selling, independently verify approved merchant checkout for goods, tax nexus and remittance, seller identity, support and returns, Printful funding float, privacy handling for shipping addresses, legal fundraising/co-venture requirements, and Printful sample proof and pricing. Do not place a production order for testing.

## Profit policy (separate from donations)

- Item sale subtotal means merchandise price **excluding separately collected buyer tax and shipping**, not a donation amount.
- Deduct only verified direct vendor production, seller-borne shipping, actual payment processing, seller-borne taxes, refunds, and documented approved per-order direct costs.
- Profit = max(0, subtotal - those costs), with no transfer while payment, fulfillment, refunds and disputes are unresolved.
- Split cleared positive net merchandise profit **50% campaign / 50% iFund**; a rounding penny goes to the campaign.
- Avoid double-counting expenses and do not allocate a negative sale as revenue. Taxes and discounts must have accounting review.
- No actual payouts until a provider-backed merchandise ledger (not the existing donation ledger), signed webhook reconciliation, returns/reversal process and payout identity are independently verified.
- Every product page and confirmation must explain the split *of profit*, not falsely state that 50% of the retail price is donated.

## Staged rollout

1. **Source complete (in progress):** owner design entry, three proofs, approved name and artwork, optional AI illustration, nonflat cosmic backgrounds and interactive buttons; local validation.
2. **Provider linked:** Printful account/store and verified read-only API status; product/variant eligibility and artwork placement spec; no purchase.
3. **Commercial backend:** R2 print files, owner-approved versioned offer, separate merchant commerce ledger, provider reconciliation, checkout and tax/returns policies, store dashboard for LINK and ORBIT.
4. **Sandbox trial:** provider-verified test orders only if supported without live charges; independent owner/customer/admin acceptance and sample quality checks.
5. **Controlled public activation:** one limited campaign pilot, signed and budgeted supplier orders; user/customer notifications, actual shipment tracking and refund support. Roll back new checkout independently of existing donations.

## Release gates

- No forced publication or AI generation; all three visual options work and user can preserve their original photo.
- Cross-owner campaign references reject; campaign editing preserves title, location, monetary goal, drafts and payments.
- Consent revoke disables new merchandise offers/public names and blocks future AI processing.
- Printful API health never leaks credentials or accepts an external arbitrary endpoint.
- No consumer can buy until real merchant checkout, seller disclosures and payout safety are verified.
- Confirm hosted PayPal donation flow and all existing financial pages still operate independently.
- Review mobile at 320/390/768 pixels, desktop, high contrast, keyboard, reduced motion, slow network, image upload failure, logout/session switch, CORS refusal, and API quotas.
- Keep Cloudflare build usage minimal; use local tests before a single consolidated preview. Do not promote on the strength of a commit alone.
