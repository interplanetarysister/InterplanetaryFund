# Functions 81–96: source static inventory
Derived from interplanetarysister/interplanetary-fund2@main. Caller relationships beyond inline function invokes are not verified.

## importExternalCampaign
Source: [base44/functions/importExternalCampaign/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/importExternalCampaign/entry.ts). Purpose (name-based, confirm behavior): import External Campaign.
Entities: PlatformConnection. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## joinFoundingWaitlist
Source: [base44/functions/joinFoundingWaitlist/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/joinFoundingWaitlist/entry.ts). Purpose (name-based, confirm behavior): join Founding Waitlist.
Entities: FoundingWaitlist. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## justGivingStagingPilot
Source: [base44/functions/justGivingStagingPilot/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/justGivingStagingPilot/entry.ts). Purpose (name-based, confirm behavior): just Giving Staging Pilot.
Entities: Campaign, ExternalCampaignPublication. Function invocations: none detected. Built-ins: none detected. External hosts in source: api.justgiving.com. Secret **names only**: JUSTGIVING_APP_ID, JUSTGIVING_STAGING_WRITE_ENABLED. Other callers: UNKNOWN pending frontend search.

## kofiWebhook
Source: [base44/functions/kofiWebhook/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/kofiWebhook/entry.ts). Purpose (name-based, confirm behavior): kofi Webhook.
Entities: WebhookEvent, PlatformConnection, Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## listConnections
Source: [base44/functions/listConnections/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/listConnections/entry.ts). Purpose (name-based, confirm behavior): list Connections.
Entities: PlatformConnection. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## listFundraisingProviderCapabilities
Source: [base44/functions/listFundraisingProviderCapabilities/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/listFundraisingProviderCapabilities/entry.ts). Purpose (name-based, confirm behavior): list Fundraising Provider Capabilities.
Entities: NONE detected. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## listInstitutionApplications
Source: [base44/functions/listInstitutionApplications/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/listInstitutionApplications/entry.ts). Purpose (name-based, confirm behavior): list Institution Applications.
Entities: Institution, GrantApplication. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## listUntrackedPayPalReceipts
Source: [base44/functions/listUntrackedPayPalReceipts/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/listUntrackedPayPalReceipts/entry.ts). Purpose (name-based, confirm behavior): list Untracked Pay Pal Receipts.
Entities: FinancialOperation, Donation, HoldingLedgerEntry. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## logPlatformEvent
Source: [base44/functions/logPlatformEvent/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/logPlatformEvent/entry.ts). Purpose (name-based, confirm behavior): log Platform Event.
Entities: PlatformEvent. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## maintainPlatformOwnedAccounts
Source: [base44/functions/maintainPlatformOwnedAccounts/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/maintainPlatformOwnedAccounts/entry.ts). Purpose (name-based, confirm behavior): maintain Platform Owned Accounts.
Entities: PlatformOwnedAccount, AdminApproval, PlatformConnection, DistributedPost. Function invocations: none detected. Built-ins: InvokeLLM. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## manageAdminBuilderWork
Source: [base44/functions/manageAdminBuilderWork/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/manageAdminBuilderWork/entry.ts). Purpose (name-based, confirm behavior): manage Admin Builder Work.
Entities: AgentDelegation. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## manageAgentContentDraft
Source: [base44/functions/manageAgentContentDraft/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/manageAgentContentDraft/entry.ts). Purpose (name-based, confirm behavior): manage Agent Content Draft.
Entities: AgentContentDraft, Campaign, PlatformConnection, UserBlog, CommunityMember, DiscussionPost. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## manageAgentWork
Source: [base44/functions/manageAgentWork/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/manageAgentWork/entry.ts). Purpose (name-based, confirm behavior): manage Agent Work.
Entities: AgentDelegation, PlatformConnection. Function invocations: verifyPlatformConnection. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## manageApprovedBuilderExecution
Source: [base44/functions/manageApprovedBuilderExecution/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/manageApprovedBuilderExecution/entry.ts). Purpose (name-based, confirm behavior): manage Approved Builder Execution.
Entities: PlatformIncident, AgentDelegation. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: IFUND_BUILDER_RELEASE_ENABLED. Other callers: UNKNOWN pending frontend search.

## manageBlog
Source: [base44/functions/manageBlog/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/manageBlog/entry.ts). Purpose (name-based, confirm behavior): manage Blog.
Entities: UserBlog, Campaign, BlogEntry. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## manageConnectedPayoutAccount
Source: [base44/functions/manageConnectedPayoutAccount/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/manageConnectedPayoutAccount/entry.ts). Purpose (name-based, confirm behavior): manage Connected Payout Account.
Entities: ConnectedPayoutAccount. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.
