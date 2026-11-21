# Voice device integration acceptance and rollout

## Product contract
Interplanetary Fund helps people accomplish goals using crowdfunding, grants, legitimate earning opportunities, volunteers, practical supplies, skills, mentoring, emotional support, and community connections. NEXUS is the main conversational guide. The eight specialists offer advice through existing permission-gated internal channels. It does not promise fundraising awards or third-party endorsement.

## Browser implementation
The member-facing NEXUS panel uses browser speech recognition and synthesis. Spoken site commands open the existing registration, login, campaign editor, account, opportunities, external connections, and publishing review screens. Publication and authentication are not authorized by an unverified voice transcript. Users must explicitly opt in to hands-free question sending. Member AI access and consent are checked by the existing backend. The assistant never accepts spoken codes as identity proof.

## Alexa preparation — not an active Alexa skill
`integrations/alexa/interaction-model.json` is the proposed custom-skill language model for invocation "interplanetary fund". It is **not** submitted, certified, hosted or discoverable automatically. No live Alexa endpoint or Amazon account linkage is configured. To enable:
1. Obtain explicit authorization to connect the appropriate Amazon Developer account (free registration is possible).
2. Create skill in Alexa Skills Kit and import the interaction model. Review the published skill policy, privacy URL and account-linking scopes.
3. Provision either Alexa-hosted processing (subject to eligibility/quotas) or a verified HTTPS skill endpoint, then implement ASK request-signature / certificate-chain / timestamp and skill-ID validation **before** processing any requests. Unverified requests must fail closed.
4. Use authorization-code + PKCE account linking for owner-specific actions. Never use raw speaker text as proof of account ownership. Device users may include children or household visitors.
5. Route goals to consent-gated NEXUS APIs. Only permit proposed read-only suggestions on unauthenticated devices; account changes and publication require independent owner checks and explicit UI review.
6. Test invocation, help, cancellation, fallback, multi-turn sessions, misrecognition, speaker changes, limits, and permission revocation. Only then request Amazon skill certification and optional name-free discovery.
7. Amazon exclusively controls which ambient user utterances result in skill recommendations. Name-free interaction is not guaranteed; never claim iFund can force Alexa to recommend its skill.

## Google Nest / Gemini for Home
Google Assistant Conversational Actions were shut down in 2023. There is no currently verified public third-party Nest conversational skill integration for this product. Google is migrating speakers to Gemini for Home. Do not implement a deceptive Google Assistant Action, misrepresent Gemini developer access, or connect a generic smart-home cloud-to-cloud action that controls no actual home devices. Revisit only upon an official supported third-party conversation interface.

## Financial and privacy gates
All provider-side publishing, money movement, legal consent, accounts, OAuth, direct messages, and irreversible actions require their respective authenticated permission and audit paths; no ambient Alexa recommendations authorize them. No guaranteed free cloud inference, hosting beyond verified quotas, or partner affiliation should be claimed.
