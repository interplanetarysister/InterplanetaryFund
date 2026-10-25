# Functions 113–128: source static inventory
Derived from interplanetarysister/interplanetary-fund2@main. Caller relationships beyond inline function invokes are not verified.

## ownerAgentChatActions
Source: [base44/functions/ownerAgentChatActions/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/ownerAgentChatActions/entry.ts). Purpose (name-based, confirm behavior): owner Agent Chat Actions.
Entities: AgentContentDraft, DistributedPost. Function invocations: applyAgentContentDraft, manageBlog, publishPost. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## payPalSubscriptionWebhook
Source: [base44/functions/payPalSubscriptionWebhook/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/payPalSubscriptionWebhook/entry.ts). Purpose (name-based, confirm behavior): pay Pal Subscription Webhook.
Entities: PayPalBillingWebhook, WebhookEvent, PayPalSubscriptionIntent. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## postCampaignUpdate
Source: [base44/functions/postCampaignUpdate/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/postCampaignUpdate/entry.ts). Purpose (name-based, confirm behavior): post Campaign Update.
Entities: Campaign, CampaignUpdate, PlatformConnection, User, FollowedCampaign, Notification. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## postDiscussionReply
Source: [base44/functions/postDiscussionReply/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/postDiscussionReply/entry.ts). Purpose (name-based, confirm behavior): post Discussion Reply.
Entities: DiscussionPost, DiscussionReply. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## prepareCollectAndWithdraw
Source: [base44/functions/prepareCollectAndWithdraw/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/prepareCollectAndWithdraw/entry.ts). Purpose (name-based, confirm behavior): prepare Collect And Withdraw.
Entities: Campaign, PlatformConnection, ConnectedPayoutAccount, ExternalCollectionAuthorization. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## processAdminActionInbox
Source: [base44/functions/processAdminActionInbox/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/processAdminActionInbox/entry.ts). Purpose (name-based, confirm behavior): process Admin Action Inbox.
Entities: AdminApproval, AdminActionMessage. Function invocations: none detected. Built-ins: InvokeLLM. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## publishInstitutionOpportunity
Source: [base44/functions/publishInstitutionOpportunity/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/publishInstitutionOpportunity/entry.ts). Purpose (name-based, confirm behavior): publish Institution Opportunity.
Entities: Institution, InstitutionOpportunity. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## publishLinkedCampaignToConnection
Source: [base44/functions/publishLinkedCampaignToConnection/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/publishLinkedCampaignToConnection/entry.ts). Purpose (name-based, confirm behavior): publish Linked Campaign To Connection.
Entities: PlatformConnection, Campaign, DistributedPost. Function invocations: none detected. Built-ins: none detected. External hosts in source: interplanetaryfund.com. Secret **names only**: APP_USER_CONNECTOR_LINKEDIN_ID. Other callers: UNKNOWN pending frontend search.

## publishPost
Source: [base44/functions/publishPost/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/publishPost/entry.ts). Purpose (name-based, confirm behavior): publish Post.
Entities: DistributedPost, Campaign, PlatformConnection. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: APP_USER_CONNECTOR_LINKEDIN_ID. Other callers: UNKNOWN pending frontend search.

## receiveCloudflareEmail
Source: [base44/functions/receiveCloudflareEmail/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/receiveCloudflareEmail/entry.ts). Purpose (name-based, confirm behavior): receive Cloudflare Email.
Entities: VerificationMailbox, User, VerificationMail, InboxItem. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## reconcileDirectPayPalCampaignDonation
Source: [base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts). Purpose (name-based, confirm behavior): reconcile Direct Pay Pal Campaign Donation.
Entities: FinancialOperation, Donation, HoldingLedgerEntry, Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## reconcileExternalPayPalSettlement
Source: [base44/functions/reconcileExternalPayPalSettlement/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/reconcileExternalPayPalSettlement/entry.ts). Purpose (name-based, confirm behavior): reconcile External Pay Pal Settlement.
Entities: Campaign, PlatformConnection, HoldingLedgerEntry. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## recordAgentInteraction
Source: [base44/functions/recordAgentInteraction/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/recordAgentInteraction/entry.ts). Purpose (name-based, confirm behavior): record Agent Interaction.
Entities: Campaign, AgentActivity. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## recordCampaignCreated
Source: [base44/functions/recordCampaignCreated/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/recordCampaignCreated/entry.ts). Purpose (name-based, confirm behavior): record Campaign Created.
Entities: Campaign, User, ActivityEvent, PlatformConnection. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## recordDonation
Source: [base44/functions/recordDonation/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/recordDonation/entry.ts). Purpose (name-based, confirm behavior): record Donation.
Entities: Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## recordExternalFundMigration
Source: [base44/functions/recordExternalFundMigration/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/recordExternalFundMigration/entry.ts). Purpose (name-based, confirm behavior): record External Fund Migration.
Entities: Campaign, ExternalFundMigrationRecord. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.
