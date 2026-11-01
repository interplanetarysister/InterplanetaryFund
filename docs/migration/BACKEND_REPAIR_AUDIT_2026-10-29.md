# IFund end-to-end backend repair audit — 2026-10-29

Authority: migration issue #137. Source repository is read-only. This document is a **coverage and repair ledger**, not a claim of functioning backend.

## Verified structural evidence

- **184 / 184** original server function entrypoints are individually enumerated.
- **398** source function → entity references, each resolving to one of **95** original entity contracts.
- **236** directly observed original frontend function calls across **123** unique backend names. Dynamic, indirect, cron, agent tools, webhook and third-party callers remain to be reconciled.
- **17** original workflow definitions all reference function names present in the inventory; 11 cron, six entity-event triggers. No workflow execution has been released.
- **95 / 95** private staging schemas and **1,126 / 1,126** named columns are present in canonical Supabase, but all 95 source staging tables have client-deny RLS policies. These tables are **not live functional API equivalents**.
- **Seven** source function names have some candidate independent operation. All seven are partial or narrower than the source behavior. **Zero** entire original function contracts have fully verified behavior across permissions, state persistence, side effects, retries and tests.
- The canonical public data runtime has no imported campaign rows and no donation/ledger rows. Earlier read-only catalog showed 27 staged campaigns. Import and owner identity correlation are unresolved.

## Risk classification (static heuristics, not permissions)

| Domain | Original handlers |
|---|---:|
| financial high risk | 45 |
| privileged identity | 16 |
| external side effect | 48 |
| metered agent | 31 |
| application | 44 |

## Backend repair rules

1. Every function requires real caller/schema mapping, source-equivalent request and response shape, trusted auth and RLS, and tests for cross-user denial, failures, idempotency and side effects. Do not mark a route complete when it merely exists.
2. Prefer narrowly scoped `SECURITY INVOKER` queries or authenticated signed-in-user RPCs and dedicated private service functions. **Never turn the staged client-deny policies into blanket public or authenticated read/write policies.**
3. No payment capture, withdrawal, subscription debit, balance mutation, or provider webhook may run without PayPal provider signature validation, idempotency, ledger reconciliation and owner approval. The original gift-first accounting and ledger must remain unmodified.
4. No agent, external connector, OAuth delegated action, social broadcast, or scheduled workflow may execute solely because a feature flag was flipped; independent identity/consent/provider/budget/audit proofs remain mandatory.
5. Restore source function callbacks, triggers, route-level UI and mobile behavior alongside backend service ports; test logged-out, member, admin and super-admin access.
6. Source-to-Postgres timestamp changes (75) need deterministic roundtrip and timezone tests. Three integer fields use bigint; arrays/objects are JSONB.
7. `scripts/audit-backend-coverage.mjs` checks this complete census and dependency graph in CI. Its `--release` mode must fail until all original functions have proven runtime equivalence or documented approved retirement.

## Candidate independent replacements (not complete ports)

- **deleteCampaign**: `worker/campaignWrites.js` — DELETE /api/campaigns/:uuid. Limit: Private draft deletion only; source published-campaign lifecycle not ported.
- **getCampaignDraft**: `worker/reads.js` — GET /api/campaigns/:uuid/draft. Limit: Owner-only limited draft fields; source wizard and AI settings absent.
- **getCommunityFeed**: `worker/reads.js` — GET /api/community/feed. Limit: Public canonical social posts only; original community context, moderation and linked campaigns not ported.
- **listConnections**: `worker/accountRoutes.js` — GET /api/account/connections. Limit: Read-only verified provider status; OAuth and connected actions not available.
- **managePublicProfile**: `apps/web/src/pages/PublicProfile.jsx` — GET /u/:id. Limit: Only public RLS-exposed campaigns and posts; original privacy flags, bio and linked content absent.
- **saveCampaign**: `worker/campaignWrites.js` — POST /api/campaigns; PATCH /api/campaigns/:uuid. Limit: Content-only draft/create/publish; no source AI, distribution or metadata parity.
- **setUsername**: `worker/accountRoutes.js` — PUT /api/account/profile. Limit: Owner-scoped public handle update only; original username availability and profile parity not verified.

## Per-handler repair ledger

The following entries are all **NOT independently released**; static domain categories are risk triage only. Source entities and direct caller references are recorded in `contracts/functions.json`.

### financial high risk

- `activateSubscriptionCheckout` — **BLOCKED**, no independent behavior verified; entities PayPalBillingWebhook, FeatureFlag; frontend direct calls: 2
- `authorizeCollectAndWithdraw` — **BLOCKED**, no independent behavior verified; entities ExternalCollectionAuthorization; frontend direct calls: 1
- `cancelPayPalSubscription` — **BLOCKED**, no independent behavior verified; entities PayPalSubscriptionIntent; frontend direct calls: 1
- `capturePayPalOrder` — **BLOCKED**, no independent behavior verified; entities Campaign, FinancialOperation, HoldingLedgerEntry; frontend direct calls: 4
- `confirmPayPalSubscription` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `createDonationCheckout` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `createPayPalOrder` — **BLOCKED**, no independent behavior verified; entities Campaign; frontend direct calls: 3
- `createPayPalSubscriptionCheckout` — **BLOCKED**, no independent behavior verified; entities NonprofitSubscriptionApproval, PayPalBillingWebhook, PayPalSubscriptionIntent; frontend direct calls: 1
- `createSubscriptionCheckout` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `deleteAccount` — **BLOCKED**, no independent behavior verified; entities User, Withdrawal, Campaign, Donation, FollowedCampaign, Notification, InboxItem, MissionBrief, Recommendation, AgentActivity, AgentDelegation, Message, CommunityMember, VolunteerSignup, DiscussionPost, DiscussionReply, GrantApplication, CampaignUpdate, DistributedPost, PlatformConnection; frontend direct calls: 1
- `deleteCampaign` — **BLOCKED**, partial candidate only; entities Campaign, AgentDelegation, AgentActivity, CampaignUpdate, CampaignTranslation, DistributedPost, PlatformConnection, Donation, Withdrawal, FinancialOperation, HoldingLedgerEntry; frontend direct calls: 1
- `discoverPayPalHoldingSettlements` — **BLOCKED**, no independent behavior verified; entities ExternalFundObservation, HoldingLedgerEntry, Campaign; frontend direct calls: 0
- `executeCollectAndWithdraw` — **BLOCKED**, no independent behavior verified; entities ExternalCollectionAuthorization; frontend direct calls: 1
- `generateIntelligence` — **BLOCKED**, no independent behavior verified; entities Campaign, Donation, Message, Opportunity, MissionBrief, Recommendation; frontend direct calls: 2
- `getCampaignDonations` — **BLOCKED**, no independent behavior verified; entities Campaign, Donation; frontend direct calls: 3
- `getCampaignWithdrawalBalance` — **BLOCKED**, no independent behavior verified; entities Campaign, Donation, HoldingLedgerEntry; frontend direct calls: 1
- `getCryptoDonationReadiness` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `getMyGiving` — **BLOCKED**, no independent behavior verified; entities Donation; frontend direct calls: 1
- `getOwnerDonorDirectory` — **BLOCKED**, no independent behavior verified; entities Campaign, Donation; frontend direct calls: 1
- `getOwnerFinancialLedger` — **BLOCKED**, no independent behavior verified; entities FinancialOperation, HoldingLedgerEntry, Campaign; frontend direct calls: 1
- `getPayPalConfig` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 3
- `getPayPalPayoutReadiness` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `getPayPalSubscriptionOptions` — **BLOCKED**, no independent behavior verified; entities NonprofitSubscriptionApproval, PayPalBillingWebhook, SubscriptionPlanMapping; frontend direct calls: 1
- `getPaymentCapabilities` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 3
- `getStripeIntegrationAudit` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `getStripeReadiness` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `getStripeSubscriptionOptions` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `listUntrackedPayPalReceipts` — **BLOCKED**, no independent behavior verified; entities FinancialOperation, Donation, HoldingLedgerEntry; frontend direct calls: 1
- `manageRecurringDonation` — **BLOCKED**, no independent behavior verified; entities Donation; frontend direct calls: 1
- `matchExternalPayPalSettlement` — **BLOCKED**, no independent behavior verified; entities HoldingLedgerEntry, ExternalFundObservation, Campaign; frontend direct calls: 0
- `payPalSubscriptionWebhook` — **BLOCKED**, no independent behavior verified; entities PayPalBillingWebhook, WebhookEvent, PayPalSubscriptionIntent; frontend direct calls: 0
- `prepareCollectAndWithdraw` — **BLOCKED**, no independent behavior verified; entities Campaign, PlatformConnection, ConnectedPayoutAccount, ExternalCollectionAuthorization; frontend direct calls: 1
- `reconcileDirectPayPalCampaignDonation` — **BLOCKED**, no independent behavior verified; entities FinancialOperation, Donation, HoldingLedgerEntry, Campaign; frontend direct calls: 1
- `reconcileExternalPayPalSettlement` — **BLOCKED**, no independent behavior verified; entities Campaign, PlatformConnection, HoldingLedgerEntry; frontend direct calls: 0
- `recordDonation` — **BLOCKED**, no independent behavior verified; entities Campaign; frontend direct calls: 1
- `repairStripeWebhookEvents` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `requestWithdrawal` — **BLOCKED**, no independent behavior verified; entities Donation, HoldingLedgerEntry, Campaign, User, Withdrawal; frontend direct calls: 5
- `runOutreachAgent` — **BLOCKED**, no independent behavior verified; entities Campaign, User, Donation, CampaignUpdate, Recommendation, AgentActivity; frontend direct calls: 0
- `sendCommunication` — **BLOCKED**, no independent behavior verified; entities Campaign, Donation, User, Notification, Message; frontend direct calls: 1
- `setupPayPalSubscriptionWebhook` — **BLOCKED**, no independent behavior verified; entities PayPalBillingWebhook; frontend direct calls: 2
- `startStripeConnectOnboarding` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `stripeWebhook` — **BLOCKED**, no independent behavior verified; entities WebhookEvent, Campaign, StripeReversalHold, FinancialOperation, User, Donation, Notification; frontend direct calls: 0
- `syncPayPalSubscriptionCatalog` — **BLOCKED**, no independent behavior verified; entities SubscriptionPlanMapping; frontend direct calls: 1
- `syncStripeSubscriptionCatalog` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `verifyOwnerPayPalBasicPlan` — **BLOCKED**, no independent behavior verified; entities SubscriptionPlanMapping; frontend direct calls: 1

### privileged identity

- `adminApiConnectionIntake` — **BLOCKED**, no independent behavior verified; entities AdminApiConnectionIntake; frontend direct calls: 1
- `adminCampaignControl` — **BLOCKED**, no independent behavior verified; entities Campaign; frontend direct calls: 2
- `adminOAuthProviderReadiness` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `adminUpdateUserRole` — **BLOCKED**, no independent behavior verified; entities User; frontend direct calls: 1
- `auditAdminAgentGateway` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `authorizeConnectionAi` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 0
- `completeOAuthConnection` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 0
- `deviceAuthorization` — **BLOCKED**, no independent behavior verified; entities DeviceAuthorization, User, Campaign; frontend direct calls: 6
- `executeAdminAgentRequest` — **BLOCKED**, no independent behavior verified; entities AgentActivity; frontend direct calls: 0
- `finalizeAppUserOAuthConnection` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, Campaign; frontend direct calls: 1
- `manageAdminBuilderWork` — **BLOCKED**, no independent behavior verified; entities AgentDelegation; frontend direct calls: 2
- `manageOAuthClients` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `processAdminActionInbox` — **BLOCKED**, no independent behavior verified; entities AdminApproval, AdminActionMessage; frontend direct calls: 0
- `registerPushDevice` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 2
- `saveConnectionCredentials` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, User, Campaign; frontend direct calls: 1
- `verifyAdminGateway` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0

### external side effect

- `acknowledgeConnectionIssue` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 1
- `broadcastPosts` — **BLOCKED**, no independent behavior verified; entities Campaign, DistributedPost, PlatformConnection; frontend direct calls: 1
- `createDiscussionPost` — **BLOCKED**, no independent behavior verified; entities CommunityMember, DiscussionPost; frontend direct calls: 1
- `createDistributedPost` — **BLOCKED**, no independent behavior verified; entities Campaign, PlatformConnection, DistributedPost; frontend direct calls: 4
- `createSocialPost` — **BLOCKED**, no independent behavior verified; entities Campaign, SocialPost; frontend direct calls: 2
- `disconnectPlatformConnection` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 1
- `discoverConnectionMethods` — **BLOCKED**, no independent behavior verified; entities PlatformConnectionRecipe; frontend direct calls: 0
- `discoverExternalCampaignSnapshot` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 0
- `draftSharePost` — **BLOCKED**, no independent behavior verified; entities Campaign, SocialPost; frontend direct calls: 0
- `externalAgentCampaigns` — **BLOCKED**, no independent behavior verified; entities ExternalAgentApiKey, Campaign; frontend direct calls: 0
- `externalAgentContentWrite` — **BLOCKED**, no independent behavior verified; entities ExternalAgentApiKey, Campaign, AuthorizationGrant, CampaignUpdate; frontend direct calls: 0
- `generateSocialContent` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `getAppUserConnector` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 2
- `getConnectedPayoutAccount` — **BLOCKED**, no independent behavior verified; entities ConnectedPayoutAccount; frontend direct calls: 0
- `getSharedConnectorStatus` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `importExternalCampaign` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 1
- `listConnections` — **BLOCKED**, partial candidate only; entities PlatformConnection; frontend direct calls: 7
- `manageConnectedPayoutAccount` — **BLOCKED**, no independent behavior verified; entities ConnectedPayoutAccount; frontend direct calls: 0
- `manageDistributedPost` — **BLOCKED**, no independent behavior verified; entities DistributedPost; frontend direct calls: 3
- `manageExternalAgentKeys` — **BLOCKED**, no independent behavior verified; entities ExternalAgentApiKey; frontend direct calls: 1
- `manageOwnerConnectionConfiguration` — **BLOCKED**, no independent behavior verified; entities PlatformConnectionRecipe, IntegrationChangeRequest; frontend direct calls: 1
- `managePostInterest` — **BLOCKED**, no independent behavior verified; entities PostInterest, SocialPost; frontend direct calls: 2
- `mirrorExternalPosts` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, User, SocialPost; frontend direct calls: 0
- `postCampaignUpdate` — **BLOCKED**, no independent behavior verified; entities Campaign, CampaignUpdate, PlatformConnection, User, FollowedCampaign, Notification; frontend direct calls: 1
- `postDiscussionReply` — **BLOCKED**, no independent behavior verified; entities DiscussionPost, DiscussionReply; frontend direct calls: 1
- `publishInstitutionOpportunity` — **BLOCKED**, no independent behavior verified; entities Institution, InstitutionOpportunity; frontend direct calls: 1
- `publishLinkedCampaignToConnection` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, Campaign, DistributedPost; frontend direct calls: 0
- `publishPost` — **BLOCKED**, no independent behavior verified; entities DistributedPost, Campaign, PlatformConnection; frontend direct calls: 4
- `recordExternalFundMigration` — **BLOCKED**, no independent behavior verified; entities Campaign, ExternalFundMigrationRecord; frontend direct calls: 1
- `requestManagedConnectionAction` — **BLOCKED**, no independent behavior verified; entities PlatformConnectionRecipe, PlatformConnection, Campaign, AgentDelegation; frontend direct calls: 1
- `resolveConnectionStatus` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, AuthorizationGrant; frontend direct calls: 5
- `resolvePlatformConnectionRecipe` — **BLOCKED**, no independent behavior verified; entities PlatformConnectionRecipe; frontend direct calls: 0
- `revokeConnectionAiConsent` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 0
- `runBrowserConnection` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, Campaign; frontend direct calls: 0
- `runOfficialSocialPromotion` — **BLOCKED**, no independent behavior verified; entities PlatformOwnedAccount, AdminApproval, WritingResearchBrief, PlatformConnection, User, DistributedPost; frontend direct calls: 0
- `runSocialAutopilot` — **BLOCKED**, no independent behavior verified; entities WritingResearchBrief, User, DistributedPost, Campaign, ScheduledAutoPostPermit, AgentActivity; frontend direct calls: 0
- `setConnectionAiToggle` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 2
- `syncConnections` — **BLOCKED**, no independent behavior verified; entities DistributedPost, ScheduledAutoPostPermit, Campaign, PlatformConnection, User, Notification; frontend direct calls: 0
- `syncExternalFunds` — **BLOCKED**, no independent behavior verified; entities Campaign, PlatformConnection, ExternalFundObservation; frontend direct calls: 3
- `syncFromConvex` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `syncGitHub` — **BLOCKED**, no independent behavior verified; entities GitHubSyncCheckpoint, PlatformAccessRegistry, User, Notification; frontend direct calls: 0
- `syncImportedCampaign` — **BLOCKED**, no independent behavior verified; entities ExternalCampaignImport, Campaign, PlatformConnection; frontend direct calls: 1
- `syncWixAnalytics` — **BLOCKED**, no independent behavior verified; entities ExternalPlatformRecord; frontend direct calls: 2
- `syncWixBusinessData` — **BLOCKED**, no independent behavior verified; entities ExternalPlatformRecord; frontend direct calls: 2
- `syncWixCampaigns` — **BLOCKED**, no independent behavior verified; entities Campaign; frontend direct calls: 2
- `syncWixContent` — **BLOCKED**, no independent behavior verified; entities SocialPost, CampaignUpdate; frontend direct calls: 2
- `verifyAppUserConnector` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `verifyPlatformConnection` — **BLOCKED**, no independent behavior verified; entities PlatformConnection; frontend direct calls: 3

### metered agent

- `analyzeGrantApplication` — **BLOCKED**, no independent behavior verified; entities GrantApplication, Institution, InstitutionOpportunity, Campaign, Recommendation, Notification; frontend direct calls: 0
- `applyAgentContentDraft` — **BLOCKED**, no independent behavior verified; entities AgentContentDraft, Campaign, PlatformConnection, UserBlog, DiscussionPost, CommunityMember, BlogEntry, PublicProfile; frontend direct calls: 0
- `checkUsernameAvailability` — **BLOCKED**, no independent behavior verified; entities User; frontend direct calls: 0
- `enforceCampaignProtocol` — **BLOCKED**, no independent behavior verified; entities Campaign, Recommendation; frontend direct calls: 0
- `generateCampaignCover` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 3
- `generateDistributionContent` — **BLOCKED**, no independent behavior verified; entities Campaign, PlatformConnection, DistributedPost; frontend direct calls: 0
- `getAgentAccountContext` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, Campaign, PublicProfile, FollowedCampaign, SocialPost, DistributedPost, CommunityMember, AgentDelegation, AgentContentDraft, PostInterest; frontend direct calls: 0
- `getAgentMailContext` — **BLOCKED**, no independent behavior verified; entities PlatformAccessRegistry, InboxItem; frontend direct calls: 0
- `getCampaignDraft` — **BLOCKED**, partial candidate only; entities Campaign; frontend direct calls: 1
- `getFeatureAvailability` — **BLOCKED**, no independent behavior verified; entities FeatureFlag; frontend direct calls: 3
- `getFundraisingMode` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `getWritingResearchBrief` — **BLOCKED**, no independent behavior verified; entities WritingResearchBrief; frontend direct calls: 0
- `joinFoundingWaitlist` — **BLOCKED**, no independent behavior verified; entities FoundingWaitlist; frontend direct calls: 1
- `listFundraisingProviderCapabilities` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `maintainPlatformOwnedAccounts` — **BLOCKED**, no independent behavior verified; entities PlatformOwnedAccount, AdminApproval, PlatformConnection, DistributedPost; frontend direct calls: 0
- `manageAgentContentDraft` — **BLOCKED**, no independent behavior verified; entities AgentContentDraft, Campaign, PlatformConnection, UserBlog, CommunityMember, DiscussionPost; frontend direct calls: 2
- `manageAgentWork` — **BLOCKED**, no independent behavior verified; entities AgentDelegation, PlatformConnection; frontend direct calls: 4
- `manageVerificationMailbox` — **BLOCKED**, no independent behavior verified; entities VerificationMailbox, VerificationMail; frontend direct calls: 4
- `ownerAgentChatActions` — **BLOCKED**, no independent behavior verified; entities AgentContentDraft, DistributedPost; frontend direct calls: 2
- `receiveCloudflareEmail` — **BLOCKED**, no independent behavior verified; entities VerificationMailbox, User, VerificationMail, InboxItem; frontend direct calls: 0
- `recordAgentInteraction` — **BLOCKED**, no independent behavior verified; entities Campaign, AgentActivity; frontend direct calls: 1
- `recordCampaignCreated` — **BLOCKED**, no independent behavior verified; entities Campaign, User, ActivityEvent, PlatformConnection; frontend direct calls: 1
- `refreshWritingResearch` — **BLOCKED**, no independent behavior verified; entities WritingResearchBrief; frontend direct calls: 0
- `reviewAgentActivity` — **BLOCKED**, no independent behavior verified; entities AgentActivity; frontend direct calls: 1
- `routeAgentTask` — **BLOCKED**, no independent behavior verified; entities AgentDelegation, Campaign; frontend direct calls: 1
- `saveCampaign` — **BLOCKED**, partial candidate only; entities Campaign; frontend direct calls: 3
- `toggleCampaignFollow` — **BLOCKED**, no independent behavior verified; entities FollowedCampaign, Campaign; frontend direct calls: 2
- `trackAgentConversation` — **BLOCKED**, no independent behavior verified; entities AgentConversationRun; frontend direct calls: 9
- `translateCampaign` — **BLOCKED**, no independent behavior verified; entities Campaign, CampaignTranslation; frontend direct calls: 4
- `updateCampaignSettings` — **BLOCKED**, no independent behavior verified; entities Campaign; frontend direct calls: 6
- `verifyAgentPlatformAccess` — **BLOCKED**, no independent behavior verified; entities PlatformAccessRegistry, User; frontend direct calls: 0

### application

- `applyInstitutionOpportunity` — **BLOCKED**, no independent behavior verified; entities InstitutionOpportunity, Institution, Campaign, GrantApplication, Notification; frontend direct calls: 1
- `communityMembership` — **BLOCKED**, no independent behavior verified; entities Community, CommunityMember; frontend direct calls: 2
- `createCommunity` — **BLOCKED**, no independent behavior verified; entities Community, CommunityMember; frontend direct calls: 1
- `createInstitution` — **BLOCKED**, no independent behavior verified; entities Institution; frontend direct calls: 1
- `createKnowledgeArticle` — **BLOCKED**, no independent behavior verified; entities KnowledgeArticle; frontend direct calls: 1
- `createPremiumDayPassCheckout` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `createSupportTicket` — **BLOCKED**, no independent behavior verified; entities SupportTicket; frontend direct calls: 1
- `createVolunteerOpportunity` — **BLOCKED**, no independent behavior verified; entities Community, CommunityMember, VolunteerOpportunity; frontend direct calls: 1
- `decideGrantApplication` — **BLOCKED**, no independent behavior verified; entities GrantApplication, Institution, Campaign, Notification; frontend direct calls: 1
- `discoverFeatures` — **BLOCKED**, no independent behavior verified; entities User, Campaign, PlatformConnection, CommunityMember, Institution, VolunteerSignup, GrantApplication, Recommendation; frontend direct calls: 0
- `geocodeCity` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `getBufferReadiness` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 0
- `getCommunityFeed` — **BLOCKED**, partial candidate only; entities ActivityEvent, FollowedCampaign, Campaign; frontend direct calls: 2
- `getLiveProviderStatus` — **BLOCKED**, no independent behavior verified; entities FeatureFlag, PlatformAccessRegistry; frontend direct calls: 1
- `getUnifiedInbox` — **BLOCKED**, no independent behavior verified; entities ExternalConversation, ExternalConversationMessage, InboxItem; frontend direct calls: 0
- `getVerifiedIFundIntegrationContext` — **BLOCKED**, no independent behavior verified; entities PlatformConnectionRecipe; frontend direct calls: 0
- `justGivingStagingPilot` — **BLOCKED**, no independent behavior verified; entities Campaign, ExternalCampaignPublication; frontend direct calls: 2
- `kofiWebhook` — **BLOCKED**, no independent behavior verified; entities WebhookEvent, PlatformConnection, Campaign; frontend direct calls: 0
- `listInstitutionApplications` — **BLOCKED**, no independent behavior verified; entities Institution, GrantApplication; frontend direct calls: 1
- `logPlatformEvent` — **BLOCKED**, no independent behavior verified; entities PlatformEvent; frontend direct calls: 1
- `manageApprovedBuilderExecution` — **BLOCKED**, no independent behavior verified; entities PlatformIncident, AgentDelegation; frontend direct calls: 2
- `manageBlog` — **BLOCKED**, no independent behavior verified; entities UserBlog, Campaign, BlogEntry; frontend direct calls: 5
- `manageFeatureFlag` — **BLOCKED**, no independent behavior verified; entities FeatureFlag, PlatformAccessRegistry; frontend direct calls: 4
- `manageFriends` — **BLOCKED**, no independent behavior verified; entities User, Friendship; frontend direct calls: 6
- `manageOfficialPublications` — **BLOCKED**, no independent behavior verified; entities OfficialPublication; frontend direct calls: 3
- `managePlatformAccess` — **BLOCKED**, no independent behavior verified; entities PlatformAccessRegistry; frontend direct calls: 1
- `managePlatformIncidents` — **BLOCKED**, no independent behavior verified; entities PlatformIncident, AgentDelegation; frontend direct calls: 3
- `managePublicProfile` — **BLOCKED**, partial candidate only; entities Campaign, FollowedCampaign, PublicProfile, User, SocialPost, CommunityMember, DiscussionPost, DiscussionReply, Community, UserBlog; frontend direct calls: 3
- `markNotificationRead` — **BLOCKED**, no independent behavior verified; entities Notification; frontend direct calls: 1
- `recordLegalAcceptance` — **BLOCKED**, no independent behavior verified; entities LegalAcceptance; frontend direct calls: 2
- `renderInterplanetaryPhoto` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `runReporterDiary` — **BLOCKED**, no independent behavior verified; entities UserBlog, User, BlogEntry, Notification; frontend direct calls: 0
- `sendPublicContactMessage` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 1
- `setUnifiedOboConsent` — **BLOCKED**, no independent behavior verified; entities PlatformConnection, AgentDelegation; frontend direct calls: 2
- `setUsername` — **BLOCKED**, partial candidate only; entities User; frontend direct calls: 0
- `startPremiumTrial` — **BLOCKED**, no independent behavior verified; entities User; frontend direct calls: 1
- `updateFollowPreferences` — **BLOCKED**, no independent behavior verified; entities FollowedCampaign; frontend direct calls: 1
- `updateInboxItem` — **BLOCKED**, no independent behavior verified; entities InboxItem; frontend direct calls: 2
- `updateMissionItemStatus` — **BLOCKED**, no independent behavior verified; entities not detected; frontend direct calls: 2
- `validateIntegrationHealth` — **BLOCKED**, no independent behavior verified; entities PlatformAccessRegistry; frontend direct calls: 1
- `volunteerFollowUp` — **BLOCKED**, no independent behavior verified; entities VolunteerSignup, User, VolunteerOpportunity, Community, Notification; frontend direct calls: 0
- `volunteerSignup` — **BLOCKED**, no independent behavior verified; entities VolunteerOpportunity, VolunteerSignup, Notification; frontend direct calls: 1
- `welcomeVolunteer` — **BLOCKED**, no independent behavior verified; entities VolunteerSignup, VolunteerOpportunity, Community, User, Notification; frontend direct calls: 0
- `wixWebhook` — **BLOCKED**, no independent behavior verified; entities ExternalSyncEvent; frontend direct calls: 0

## Release state

**Not ready.** No evidence authorizes enabling services or performing financial/external operations. The open draft PR tracks code preparation only; full test suite, build, provider sandbox, owner approval and Android tests remain outstanding.
