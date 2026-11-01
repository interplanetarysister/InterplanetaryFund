# IFund Public Legal Help, Copyright Notice & PayPal Platform Support — 2026-10-13

## Public Help Center content — written to the live Base44 HelpArticle collection

Six legal Help Center records were inserted and queried after creation (count = 6):
- /help/terms-of-service — entire current TERMS_SECTIONS, version 2026-10-13-v3, not an old draft
- /help/privacy-policy — current PRIVACY_SECTIONS
- /help/copyright-and-intellectual-property — what IFund claims, open-source and campaign-content exceptions, lawful uses, rightsholder identity limitations
- /help/campaign-authority-and-ai-permissions — creators, IFund managers, delegated AI and platform-specific approvals
- /help/payment-holding-and-withdrawals — conditional money handling and fees; a zero balance reported by the owner, not a reconciliation-certified assertion
- /help/copyright-permissions-and-reporting — rights questions and good-faith infringement reporting, without implying registered DMCA agent status

These are PUBLIC HelpArticle records; internal privileged research, the earlier archived legal versions, API secrets, and financial records were not published.

The `Legal & Policies` Help Center category was added in the Base44 `HelpArticle` and `HelpDraft` schemas without altering the RLS rules. `src/pages/Help.jsx` has a permanent Legal section with direct links. The existing `/terms` and `/privacy` public routes remain and are linked from the footer and signup.

## Copyright presentation
- Public-facing footer: **© 2026 Interplanetary Fund · All rights reserved** with `Interplanetary Fund` linking to `/help/copyright-and-intellectual-property`.
- The Home, About and Contact public pages now include the footer, in addition to existing authenticated/public Layout pages.
- `README.md` and `LICENSE` link to the public copyright article, while the `LICENSE` preserves actual named human-author ownership assertions; a public brand label does not transfer the copyright by itself.
- Copyright protection applies to original protectable work, not all third-party packages, user content, machine-only unprotectable material, facts or general ideas. No trademark registration or guaranteed enforcement is claimed.
- Rights claims and infringement reports can go through the public copyright Help page and /contact.

## PayPal platform-support correction
- Removed generated `https://www.paypal.com/donate/?cmd=_donations&business=...` URLs that failed for this IFund business account.
- `src/lib/paypalLink.js` now returns the previously owner-supplied official IFund merchant link `https://www.paypal.com/ncp/payment/VMW5XU3Y46K5J` for **platform support only**, including platform-only campaign previews and cross-posted platform-support messages.
- `PayPalDonateButton` launches the provider-hosted page in a browser popup on desktop where permitted, with normal new-tab behavior on small screens and blocked popups.
- Button label now says **Support Interplanetary Fund with PayPal**, not a claim of eligibility to use PayPal's charity Donate SDK.
- This is an official PayPal-hosted Payment Link, **NOT** a PayPal Donate SDK hosted_button_id. Its merchant-side active status, amount setup, and successful live settlement have NOT been verified via the PayPal business dashboard or a completed payment.
- No campaign funding flows, canonical ledger accounting, third-party beneficiaries or checkout/withdrawal logic were modified.
- If the NCP link also refuses payments, PayPal Business must check **Saved links and buttons**, account restrictions, and generate an eligible working Payment Link / Buy Button. A merchant-specific hosted_button_id and merchant client ID are required for a fully embedded PayPal Buy Button; do not invent them.

## Verification and deployment
- `HelpArticle` records were re-queried and verified by their exact public slugs and IDs.
- Tests passed: Vite build, lint, TypeScript, versioned legal terms, mobile layout, 67 financial-integrity checks and PayPal platform business/checkout/recovery contract tests.
- Source changes must be deployed/published to update the footer and Help Center category on the running website. Code and database publication are separate. The published site and live merchant payment transaction could not be independently verified by tools in this turn; avoid describing either as end-to-end confirmed.
- No new costs, secrets, or third-party packages were added.
