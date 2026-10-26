# IFund donations held in custody: legal terms v2 research and operational gate
**Date:** 2026-10-13
**Document status:** research + source-level legal draft; not a license, regulatory exemption, court-approved waiver, or actual payout guarantee. A financial-regulation attorney must review before live launch or expansion.

## Verified IFund code model
- `base44/functions/createPayPalOrder/entry.ts` creates an IFund merchant PayPal checkout.
- `base44/functions/capturePayPalOrder/entry.ts` says the PayPal business account receives settled funds and records a campaign-level `HoldingLedgerEntry`.
- `base44/functions/requestWithdrawal/entry.ts` uses canonical ledger reservations, sends payouts through the IFund PayPal business account, and limits nonsubscribers to one withdrawal request per day; eligible subscriptions remove that request-frequency limit.
- `base44/shared/fees.js`: proposed gift-first checkout quotes preserve the donor's chosen campaign gift and add optional 10% support and channel processing costs to the total; 3% IFund fee is deducted once at withdrawal, visible to the campaign owner. Historic donor payments retain their original recorded allocations.
- **Unverified operational facts**: real PayPal merchant approval for fundraising/payment facilitation; bank/payments licensing; actual trust or FBO account status; verified funds held vs donor liabilities; processor hold periods; state registration; payout authorization and eligibility; compliance with the target 3-day/14-day schedule. A compile/test cannot verify these.

## User-requested intent and legally prudent implementation
The user proposes permission for IFund to temporarily use donated funds provided it pays campaign owners within two weeks after withdrawal request, with normal withdrawal availability three days after receipt and usual once-daily requests. This creates major financial and personal-liability risks.

**v2 source agreement protects the intended payout cadence without granting unrestricted operational use of campaign money:**
- IFund is accurately described as holding on-platform donations in its own business PayPal account, with campaign-level allocations.
- The platform may spend genuinely earned revenue and separately authorized direct platform donations.
- It may **not** borrow, spend, lend, invest speculatively, pledge or use other people's campaign money for its own business while legally obligated to pay those balances; user clickwrap is not substitute for licensing, required asset coverage, actual provider consent, or statutory trust duties.
- Normal availability **target**: approximately 3 calendar days after IFund's initial receipt of a completed payment, conditional on processor verification/settlement/hold status.
- One daily payout **request** for nonsubscribers; authorized subscribers can bypass request-count limits if entitlement supports it.
- Eligible payout **target**: no later than 14 calendar days after the valid request, **or sooner if law or provider contract mandates**. Lawful payment-provider holds, identity/fraud checks, disputes, injunctions and sanctions restrictions may prevent payout. The target must never be represented as a legally guaranteed right to defer.
- The existing Terms' liability cap expressly excludes money that must legally be returned, paid or restored to campaign owners. Funds remain held-payable liabilities until correctly settled, disbursed or refunded.
- Any future proposal to invest safeguarded reserves or realize float income requires an approved licensure/exemption decision, permissible assets, separate legal opinion, processor permission, actual daily coverage/liquidity controls, and tailored terms. This implementation does NOT enable that activity.
- The Terms explicitly do not claim PayPal business balances are FDIC-insured beneficiary accounts, escrow accounts, or safeguarded trust assets unless legally documented. Labels in a ledger alone do not create those statuses.

## Current authoritative legal sources
1. California Financial Code § 2081 requires, for applicable licensed transmitters, *eligible securities >= outstanding transmission liabilities at all times*. Money is a liability until recipient receipt confirmation or customer refund; eligible securities may be held in statutory trust in insolvency. https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=2081.&lawCode=FIN
2. Washington RCW 19.230.200 requires permissible investments covering outstanding average daily transmission liabilities; crypto requires like-kind holdings. https://app.leg.wa.gov/RCW/default.aspx?cite=19.230.200
3. Washington RCW 19.230.330 generally requires transmission within **10 business days of initial receipt**, not 14 days from when a beneficiary chooses to request payout, subject to statutory exceptions/instructions. https://app.leg.wa.gov/RCW/default.aspx?cite=19.230.330
4. Washington DFI money transmitter examinations identify client-fund liabilities and investments as core examination issues. https://dfi.wa.gov/money-services/examinations
5. PayPal AUP lists **payment facilitator / money-services / escrow** services as categories requiring PayPal pre-approval. https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
6. PayPal user agreement states risk holds may last **up to 21 days** ordinarily and longer for disputes; a 3-day availability projection and a 14-day payout target cannot override PayPal. https://www.paypal.com/us/legalhub/paypal/useragreement-full
7. California DFPI guidance distinguishes FBO custodial arrangements approved for safeguarding from informal commercial accounts: https://dfpi.ca.gov/rules-enforcement/laws-and-regulations/opinion-letters-by-law-subject/funds-held-in-custodial-account-as-eligible-securities/
8. State-by-state fundraising platform registration (e.g., California AB 488) and money transmission determinations must be checked separately. https://oag.ca.gov/charities/pl

## Before declaring ready to accept / use customer funds
- Verify IFund's actual legal entity, personal guarantees and operating state; consult counsel about company-vs-personal liability.
- Verify required PayPal approval for fundraising and marketplace/payment facilitation as currently structured.
- Commission a state-specific money-transmission/charitable-fundraising opinion and document approved onboarding jurisdictions; don't treat website geoblocking alone as exemption.
- Build 100% verified liabilities vs safeguarded assets reconciliation with reserve controls, daily independent settlement confirmation and immutable audit trails.
- Correct unresolved real PayPal donations not reflected in campaign balances; confirm no user-facing misrepresentations.
- Add explicit transaction-specific custodial/recipient acknowledgement and estimated payout/fees in donation checkout; general signed-in clickwrap doesn't bind anonymous donors.
- Separate IFund revenue from liabilities owed to campaigns in real provider account structures; no operational use of others' funds without written regulatory/provider approval and a safe legal structure.
- Review states with delivery periods shorter than IFund target, including Washington's 10-business-day-from-receipt rule.
- Get licensed legal review for consumer liability caps, minors, digital assets and privacy.
- Live test actual beneficiary payouts and no-stale-balance accounting, not only source build.

## Preservation and change history
- Original terms/Privacy v1 text: `docs/IFUND_TERMS_PRIVACY_2026-10-13_v1_ARCHIVE.txt`
- Original acceptance backend v1: `docs/IFUND_ACCEPTANCE_2026-10-13_v1_ARCHIVE.txt`
- v2 edited in `src/lib/legalPolicy.js` and `base44/functions/recordLegalAcceptance/entry.ts`, forcing re-acceptance for any user who accepted v1.
- `src/components/TermsAcceptance.jsx` now explicitly advises IFund's funds-holding arrangement.
- Existing license/IP terms, original v1 archive, and unrelated financial/payments logic preserved.
- Do not deploy until legally reviewed; do not claim a payout SLA is working from the contract alone.
