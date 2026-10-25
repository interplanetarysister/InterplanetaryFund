# IFund Rights, Payment Liability, and Clickwrap Protection Research
**Research date:** 2026-10-13
**Status:** Source changes implemented; **not** attorney-approved, not yet live-provider tested, and not a guaranteed liability shield. Do not publish as a certified legal solution without a licensed attorney reviewing applicable jurisdictions and corporate formation.

## Actual IFund findings
- The public GitHub repository (`interplanetarysister/interplanetary-fund2`) has no top-level `LICENSE`, `NOTICE`, or `CODEOWNERS`. Source visibility is not public-domain dedication; GitHub fork permissions still apply. Third-party dependencies retain their own licenses.
- `src/components/LegalFooter.jsx` already asserts © 2026 Michelle Rogers / IFund. Legal identity, formation state, registered agent, and chain-of-title for all assets must be verified; do **not** invent an LLC or registered trademark.
- Previous `TermsAcceptance` gated *all* visitors each session and logged only `sessionStorage`; weak proof of consent and poor usability. Replaced with server-recorded current-version assent for signed-in users, with standalone read-accessible `/terms` and `/privacy`. Guest users are not required to click through before browsing.
- `LegalAcceptance` is append-only from privileged server function `recordLegalAcceptance`, with owner read and admin only mutation; contains owner ID, server time, document version, exact acceptance method and URLs, with no client-supplied timestamp.
- Source-level implementation does **not** force new terms on backend API calls bypassing the browser (e.g. direct entity writes). Server-side transactional controls and production clickwrap/browser audit remain separately necessary.
- Public donor payment checkout must show particular fees and money risks independently; simply opening the site never forms a financial agreement.
- User-level AI grant / per-connection OBO permissions remain separate. General Terms do not authorize AI to publish or transfer funds.
- Stripe/PayPal receiving and payout readiness, settlement attribution, refunds, 3% fee trigger, and fraud controls require individual provider and licensed-professional verification. Documented unresolved PayPal donation attribution must be fixed; a contractual disclaimer cannot replace accurate books and restitution.

## Liability reduction plan in priority order
1. **Founder/owner segregation:** verify actual registered entity with public state registry, EIN, good standing, business bank account, records, operator agreements and contracts signed in correct entity's name. Form a suitable LLC/corporation if not yet registered. Maintain separate finances, adequate funding, no personal guarantees where possible. A contract cannot erase personal liability for personally committed torts, guarantees, intentional fraud, regulatory violations, or some tax/payroll liabilities. Consider cyber/E&O/general liability insurance; no-cost build cannot buy coverage or form the entity.
2. **Payment processor custody structure:** use licensed/authorized processor or custodian, documented flow of funds, bank/ledger segregation, refunds/chargeback reconciliation, processor settlement evidence and supported KYC/AML/sanctions. Obtain opinion on state money transmission obligations before holding, converting, pooling or paying out third-party funds. A FinCEN administrative ruling only recognizes a payment processor exemption under specific facts; do not assume IFund qualifies.
3. **Donation/charitable solicitation:** distinguish gifts to private individuals from charity donations and securities/crowdfunding investments. Do not advertise automatic tax-deductibility. Research state-by-state charitable-solicitation / charitable fundraising platform rules where IFund operates, California and other relevant jurisdictions, and prohibited cause categories. If a campaign offers securities/equity, require an appropriately registered intermediary and separate regulated flow.
4. **Legal person/content:** document original authorship, consultant/agent assignments, third-party license SBOM/notice, artwork source files, trademark clearance and trademark application before using ®, optional copyright registration, trade-secret access controls. Evaluate private repo access without disrupting Base44 sync, and avoid making claims that AI-only material is automatically copyrightable.
5. **Consumer contracts:** prominently display current Terms, payment-specific disclosures, an unchecked assent box, a conspicuous decision button, backend evidence of exact version, and new assent for material changes. Preserve previous versions in source history and immutable evidence. Do not use mere browsewrap or treat a privacy notice as a substitute for actual security measures.
6. **Disputes:** legal counsel may evaluate a separately prominent individual arbitration addendum with fair venue, real provider fees, small claims/regulator rights, reasonable opt-out, class action waiver only where lawful, and state-specific enforceability. **Not enabled** in initial draft because dispute-provider costs, actual operating state, and consumer arbitration compliance are not established. Carnival Cruise Lines v. Shute supports a fair disclosed forum clause, not blanket immunity.
7. **Insurance and operational controls:** cyber liability, technology E&O, general business liability and crime/financial protection with exclusions reviewed. Maintain incident response, chargeback investigation, documentation and proof of provider-side settlement.
8. **Privacy and children:** confirm actual data processors, retention periods, rights request handling, consent for AI tools, international transfers, device tracking, vendor training uses, COPPA exposure. Do not promise more than implementation guarantees.
9. **Consumer/employee limitations:** never waive nonwaivable consumer rights, fraud remedies, honest reviews, statutory data rights, financial transfer rights, or liability arising from IFund's own legally wrongful acts. A one-sided blanket waiver can be unenforceable and increase deceptive-practices exposure.

## Original primary/authoritative research
- U.S. Small Business Administration on LLC liability and insurance: https://www.sba.gov/counseling/launch-your-business/
- Cornell Legal Information Institute, electronic contracts/clickwrap: https://www.law.cornell.edu/wex/adhesion_contract_(contract_of_adhesion)
- Electronic Fund Transfer Act nonwaiver, 15 USC 1693l: https://www.law.cornell.edu/uscode/text/15/1693l
- U.S. Supreme Court, Carnival Cruise Lines v Shute (1991): https://www.law.cornell.edu/supremecourt/text/499/585
- Vessel-owner negligence waiver restriction, 46 USC 30509: https://uscode.house.gov/view.xhtml?edition=2015&req=granuleid%3AUSC-2015-title46-chapter305
- FinCEN payment processor exemption, fact-specific (FIN-2014-R009): https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business
- SEC regulated securities crowdfunding distinctions: https://www.sec.gov/resources-small-businesses/exempt-offerings/regulation-crowdfunding
- FTC on consumer privacy promises and unilateral AI-company policy changes: https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/02/ai-other-companies-quietly-changing-your-terms-service-could-be-unfair-or-deceptive
- FTC CRFA prohibiting contractual bans on honest reviews: https://www.ftc.gov/business-guidance/resources/consumer-review-fairness-act-what-businesses-need-know
- U.S. Copyright Office AI human-authorship threshold: https://copyright.gov/newsnet/2025/1060.html
- USPTO trademark rights and registration: https://www.uspto.gov/trademarks/basics/why-register-your-trademark

## Production blocking attorney review issues
- Operator legal entity, state of formation, address for service, verified user geography, tax status, license/custody arrangement, age requirements.
- Controversial damage cap: greater of platform fees in previous 12 months or $100. Counsel to review state consumer/financial-services requirements and fund custody exceptions.
- Organizer indemnity and license scope, payment reversals/refunds, creator fraud response, charitable solicitations and donor tax receipt language.
- AI outputs, consumer protections, insurance coverage and product-liability exposure. Open-source code does not shift responsibility for IFund's conduct.
- Privacy policy is a **provisional disclosure** and explicitly calls for accurate provider/retention inventory before wide release.
- Financial features and direct third-party fund handling **must not be activated merely because users accepted Terms**.
