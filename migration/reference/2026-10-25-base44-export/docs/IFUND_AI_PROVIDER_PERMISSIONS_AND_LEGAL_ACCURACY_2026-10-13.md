# IFund legal accuracy and third-party AI authorization — 2026-10-13

Status: research and internal implementation plan. No third-party permission, exception, API approval, money-transmitter exemption or negotiated contract is established by this document.

## IFund's actual business roles

1. **Member-created campaign:** The creator supplies the fundraising purpose, details and intended beneficiary; IFund provides campaign creation/management tools, communications, promotion, and optional AI delegation. IFund may act as an **authorized manager, promoter, or agent** for this campaign. The word "organizer" in an external platform's legal framework may apply to IFund's conduct; a general disclaimer cannot eliminate that regulatory classification.
2. **IFund-created or IFund-managed campaign:** IFund may independently originate a campaign or take on fuller responsibility under a separately approved campaign agreement, identifying the real creator, legal beneficiary, operator role, fees and boundaries of authority. This is an intended product class, not a claim that every campaign is currently IFund-managed.
3. **External account:** Owner-authorized publishing requires the account owner's permission and the external platform's effective API permissions or a negotiated written permission. The IFund campaign-content license is distinct from OAuth authorization and the provider contract.
4. **Fundraising money:** Source code supports receipt into an IFund PayPal business account and campaign-level ledger, with later withdrawals if enabled. On October 13 the user reports IFund's actual account balance as $0; this is not an independently verified historical reconciliation or proof that no unresolved donor payments or liabilities exist. Contracts must distinguish architectural capability from live balances and live processor permissions.
5. **Outside fundraising platforms:** `publishLinkedCampaignToConnection` explicitly returns a manual-handoff response for crowdfunding providers when no authorized external-create API exists; such platforms must not be advertised as live cross-site automatic campaign creation.

## Long-term platform agreement goal

IFund intends to create software that can serve as an authorized, user-delegated AI operator across multiple social and fundraising platforms, and to negotiate explicit **business-use, automation, and AI-specific permission agreements** with providers permitting expanded or currently restricted functionality.

Every provider approval requires:
- Identified contracting entity and a verified business contact.
- Scope: account connection; user-authorized account creation; campaign creation and updates; social publishing and comments; inbox/messages; supporter outreach; data read/write; analytics; approved API or browser actions; permitted frequency; allowed account types; and whether use by AI agents is permitted.
- Rules: official API vs approved non-API routes, authentication, MFA/CAPTCHA handling, rate limits, commercial usage, required content labels, opt-out, logs and retention, security incident handling, provider review.
- Financial boundary: authority to post or create a campaign is **not** permission to collect or redirect contributions. Any fund collection, escrow/custody, charity or payout provisions require separate provider contracts and statutory compliance.
- Documented approval: signed amendment, developer approval decision, verified API scopes, permitted account ID, start and expiration dates, renewal obligations, restrictions, and provider revocation process.
- Default: unsupported operations remain disabled or manual; preparation of a draft is not proof of successful posting.

## Evidence and initial priorities

**Buffer:** Official app client/OAuth access can support scheduling or creating posts in a connected user's Buffer account. User consent, app permissions and downstream social channel restrictions remain relevant. A personal key authorizes only the owner of that key, not arbitrary IFund users. See https://developers.buffer.com/guides/building-apps.html

**X:** The published automation rules permit some consented OAuth-based automated actions, but they ban non-API scripted website automation and require express user action-specific consent and opt-out. A special exception must be **granted** before relying on different access methods. See https://help.x.com/en/rules-and-policies/x-automation

**Reddit:** Official commercial Data API/Developer Platform use requires Reddit approval and possibly a separate agreement, even if a Reddit user authorizes IFund. Do not claim Reddit permission based solely on OAuth or an API token. See https://redditinc.com/policies/data-api-terms and https://support.reddithelp.com/hc/en-us/articles/14945211791892-Reddit-Developer-Interfaces

**Meta/Facebook/Instagram:** Obtain relevant business app review and approved scopes/permissions under the current Meta platform developer policies; access to messaging, pages, groups, social publishing, and donations is not interchangeable. Provider-specific, reviewed applications and capabilities required; don't treat a standard sign-in as approval for all activities.

## Standard agreement proposal for future provider negotiations

"Provider grants Interplanetary Fund (IFund), subject to the written permitted-use schedule and each end user's authorization, the right to operate its AI-assisted fundraising management software for the specific approved actions identified in Exhibit A. IFund may access the approved user's connected account by Provider's authorized methods, execute only actions within the approved scope, and maintain attributable logs and an effective opt-out. This authorization includes AI-assisted execution only to the extent expressly checked in Exhibit A. No right to harvest data, bypass security, send prohibited unsolicited messages, move funds, create accounts by unauthorized means, or exceed platform limits is implied. Provider may retain contractually defined safety and abuse controls. Changes in scope require documented amendment or platform authorization. Each party retains its own intellectual property and remains responsible for its conduct and legal obligations."

Proposed Exhibit A fields: provider, jurisdictions, approved endpoint/method, specific actions, permitted actor (IFund-owned vs user-owned account), ability to delegate to AI, posting frequency/limits, campaign classes, live approval reference, expiration, and review contact. This is a discussion draft—not a legally binding offer accepted by any provider.

## Preservation and implementation record

Prior legal terms and backend consent versions v1 and v2 archived; v3 is the corrected draft in `src/lib/legalPolicy.js` and `base44/functions/recordLegalAcceptance/entry.ts`. The new v3 clickwrap explains delegated campaign promotion and conditional payment handling without suggesting IFund holds a positive balance now.

No new API credentials, paid services or provider exemptions were acquired. No external posting features or financial transactions were activated. Live publishing of legal documents remains separate from saving source; get licensed legal review for charitable fundraising, money handling, and the full chain of operator authority.
