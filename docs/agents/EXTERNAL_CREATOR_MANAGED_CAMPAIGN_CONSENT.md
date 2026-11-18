# External fundraiser creator permission and IFund-managed campaign workflow

**Purpose:** let IFund agents approach a fundraiser creator who is not an IFund member, ask permission to help, and offer either self-service signup or an explicitly authorized no-login managed service.

## Conversation sequence

1. **Identify and approach the creator.** Agents may research external fundraising opportunities and contact creators using already-authorized outreach channels. Identify IFund honestly. Do not imply an existing relationship, endorsement, partnership, or campaign approval.
2. **Ask permission to help.** Ask whether the creator is interested in IFund helping with their fundraiser. Before a yes, only give a neutral explanation and request permission to continue. Do not create campaign-specific fundraising copy, edit their fundraiser, contact donors about it, publish, or manage it.
3. **Offer exactly two paths after interest is expressed:**
   - **Creator account:** invite them to create an IFund account and create/import/link the campaign. They remain the campaign owner and can use the normal IFund agents.
   - **IFund-managed service without an IFund login:** ask whether they expressly authorize IFund to prepare and manage a campaign on their behalf. They do not need an IFund login, but must complete a secure, verifiable authorization and identity/beneficiary checks.
4. **Capture a separate mandate.** A generic positive reply or a reply to the initial invitation is not enough. A trusted verification step must bind the creator to the exact fundraiser and capture the authorization version, identity/authority evidence, campaign/source URL, permitted tasks, external channels, duration/expiry, contact/delivery destination, and revocation method. Record separate toggles/scopes for drafting, editing, publishing, external posting/outreach, donor messaging, and any financial activity. No scope is inferred from another.
5. **Create a private IFund draft only after verification.** The draft must clearly identify the real creator and beneficiary, state that IFund prepared/manages it, preserve source provenance, and have an audit trail. It must not falsely show the creator as an IFund member or claim they personally authored/approved content.
6. **Send the work back to the creator.** Provide a secure, expiring review link or other verified delivery path. The creator can review the complete draft, request edits, approve or reject it, and revoke the mandate. Do not publish merely because the creator authorized preparation/management.
7. **Publication and fundraising are separate gates.** Before publication or donor solicitation, require creator approval of the final content, verified identity/beneficiary and permitted payout destination, applicable legal/platform checks, and separate publication/outreach authorization. Donations must go only to the authorized checkout and payout beneficiary. IFund must not collect and forward outside donations or claim custody/authority without a separately approved compliant payment arrangement.

## Authorization states

`discovered -> invitation_sent -> interested -> awaiting_choice -> account_signup`

or

`discovered -> invitation_sent -> interested -> awaiting_choice -> mandate_pending -> identity_pending -> mandate_verified -> draft_preparation -> creator_review -> changes_requested | creator_approved -> publication_eligible`

Any state may transition to `declined`, `expired`, or `revoked`. A decline, expiry, failed identity check, or revocation stops campaign-support actions. A new mandate is required to expand scope or resume after revocation.

## Required backend model

Do not store this as an ordinary owner approval, agent delegation, social-account connection, or an unverified external campaign link. Implement a dedicated append-only creator mandate/audit model with:
- opaque mandate ID and one-time, hashed, expiring verification token;
- creator name and minimum contact/identity evidence needed for verification, stored privately with retention controls;
- source fundraiser URL/provider and verified control/authority evidence;
- exact scopes and channels, authorization text/version, consent timestamp, expiry, status and revocation event;
- a separate IFund-managed campaign representation linked to the canonical IFund campaign, with creator/beneficiary attribution and a clear IFund management principal;
- immutable event history for invitation, consent, identity verification, draft creation/revisions, creator delivery, review, approval, publication and revocation;
- creator-facing secure review/delivery access that does not require an IFund account but cannot be guessed, reused after expiry, or expose another creator's data.

**Ownership design blocker:** current canonical `ifund_campaigns.owner_id` is a signed-in IFund user and existing campaign RPCs enforce `owner_id = auth.uid()`. Do not assign an external creator a fabricated user ID, create an account without their consent, impersonate them, or weaken existing owner RLS. Before a managed campaign can become a canonical public IFund campaign, implement and security-test a first-class managed-representation/agency ownership model that preserves the real creator as rights-holder and uses an IFund-controlled management principal. Existing owner-only agent RPCs must explicitly authorize either the signed-in owner or a valid, scoped, unexpired managed mandate.

## Current delivery status

This branch adds the agent conversation/consent policy only. It does **not** yet implement the mandate database, secure identity/token verification, managed-campaign ownership model, review portal, or verified delivery channel. The current campaign creation API writes only for the authenticated user through RLS. Therefore agents must explain that no-login managed campaign creation is not yet available and offer normal IFund signup/import until those backend controls are implemented and tested.
