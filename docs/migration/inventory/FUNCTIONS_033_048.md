# Functions 33–48: source static inventory
Derived from interplanetarysister/interplanetary-fund2@main. Caller relationships beyond inline function invokes are not verified.

## decideGrantApplication
Source: [base44/functions/decideGrantApplication/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/decideGrantApplication/entry.ts). Purpose (name-based, confirm behavior): decide Grant Application.
Entities: GrantApplication, Institution, Campaign, Notification. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## deleteAccount
Source: [base44/functions/deleteAccount/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/deleteAccount/entry.ts). Purpose (name-based, confirm behavior): delete Account.
Entities: User, Withdrawal, Campaign, Donation, FollowedCampaign, Notification, InboxItem, MissionBrief, Recommendation, AgentActivity, AgentDelegation, Message, CommunityMember, VolunteerSignup, DiscussionPost, DiscussionReply, GrantApplication, CampaignUpdate, DistributedPost, PlatformConnection. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: STRIPE_SECRET_KEY. Other callers: UNKNOWN pending frontend search.

## deleteCampaign
Source: [base44/functions/deleteCampaign/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/deleteCampaign/entry.ts). Purpose (name-based, confirm behavior): delete Campaign.
Entities: Campaign, AgentDelegation, AgentActivity, CampaignUpdate, CampaignTranslation, DistributedPost, PlatformConnection, Donation, Withdrawal, FinancialOperation, HoldingLedgerEntry. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## deviceAuthorization
Source: [base44/functions/deviceAuthorization/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/deviceAuthorization/entry.ts). Purpose (name-based, confirm behavior): device Authorization.
Entities: DeviceAuthorization, User, Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: interplanetaryfund.com. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## disconnectPlatformConnection
Source: [base44/functions/disconnectPlatformConnection/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/disconnectPlatformConnection/entry.ts). Purpose (name-based, confirm behavior): disconnect Platform Connection.
Entities: PlatformConnection. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## discoverConnectionMethods
Source: [base44/functions/discoverConnectionMethods/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/discoverConnectionMethods/entry.ts). Purpose (name-based, confirm behavior): discover Connection Methods.
Entities: PlatformConnectionRecipe. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## discoverExternalCampaignSnapshot
Source: [base44/functions/discoverExternalCampaignSnapshot/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/discoverExternalCampaignSnapshot/entry.ts). Purpose (name-based, confirm behavior): discover External Campaign Snapshot.
Entities: PlatformConnection. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## discoverFeatures
Source: [base44/functions/discoverFeatures/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/discoverFeatures/entry.ts). Purpose (name-based, confirm behavior): discover Features.
Entities: User, Campaign, PlatformConnection, CommunityMember, Institution, VolunteerSignup, GrantApplication, Recommendation. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## discoverPayPalHoldingSettlements
Source: [base44/functions/discoverPayPalHoldingSettlements/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/discoverPayPalHoldingSettlements/entry.ts). Purpose (name-based, confirm behavior): discover Pay Pal Holding Settlements.
Entities: ExternalFundObservation, HoldingLedgerEntry, Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## draftSharePost
Source: [base44/functions/draftSharePost/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/draftSharePost/entry.ts). Purpose (name-based, confirm behavior): draft Share Post.
Entities: Campaign, SocialPost. Function invocations: none detected. Built-ins: InvokeLLM. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## enforceCampaignProtocol
Source: [base44/functions/enforceCampaignProtocol/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/enforceCampaignProtocol/entry.ts). Purpose (name-based, confirm behavior): enforce Campaign Protocol.
Entities: Campaign, Recommendation. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## executeAdminAgentRequest
Source: [base44/functions/executeAdminAgentRequest/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/executeAdminAgentRequest/entry.ts). Purpose (name-based, confirm behavior): execute Admin Agent Request.
Entities: AgentActivity. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## executeCollectAndWithdraw
Source: [base44/functions/executeCollectAndWithdraw/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/executeCollectAndWithdraw/entry.ts). Purpose (name-based, confirm behavior): execute Collect And Withdraw.
Entities: ExternalCollectionAuthorization. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## externalAgentCampaigns
Source: [base44/functions/externalAgentCampaigns/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/externalAgentCampaigns/entry.ts). Purpose (name-based, confirm behavior): external Agent Campaigns.
Entities: ExternalAgentApiKey, Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: interplanetaryfund.com. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## externalAgentContentWrite
Source: [base44/functions/externalAgentContentWrite/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/externalAgentContentWrite/entry.ts). Purpose (name-based, confirm behavior): external Agent Content Write.
Entities: ExternalAgentApiKey, Campaign, AuthorizationGrant, CampaignUpdate. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## finalizeAppUserOAuthConnection
Source: [base44/functions/finalizeAppUserOAuthConnection/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/finalizeAppUserOAuthConnection/entry.ts). Purpose (name-based, confirm behavior): finalize App User OAuth Connection.
Entities: PlatformConnection, Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.
