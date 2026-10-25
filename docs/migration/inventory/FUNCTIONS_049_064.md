# Functions 49–64: source static inventory
Derived from interplanetarysister/interplanetary-fund2@main. Caller relationships beyond inline function invokes are not verified.

## generateCampaignCover
Source: [base44/functions/generateCampaignCover/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/generateCampaignCover/entry.ts). Purpose (name-based, confirm behavior): generate Campaign Cover.
Entities: NONE detected. Function invocations: none detected. Built-ins: GenerateImage. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## generateDistributionContent
Source: [base44/functions/generateDistributionContent/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/generateDistributionContent/entry.ts). Purpose (name-based, confirm behavior): generate Distribution Content.
Entities: Campaign, PlatformConnection, DistributedPost. Function invocations: none detected. Built-ins: InvokeLLM. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## generateIntelligence
Source: [base44/functions/generateIntelligence/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/generateIntelligence/entry.ts). Purpose (name-based, confirm behavior): generate Intelligence.
Entities: Campaign, Donation, Message, Opportunity, MissionBrief, Recommendation. Function invocations: none detected. Built-ins: InvokeLLM. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## generateSocialContent
Source: [base44/functions/generateSocialContent/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/generateSocialContent/entry.ts). Purpose (name-based, confirm behavior): generate Social Content.
Entities: NONE detected. Function invocations: none detected. Built-ins: InvokeLLM, GenerateImage. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## geocodeCity
Source: [base44/functions/geocodeCity/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/geocodeCity/entry.ts). Purpose (name-based, confirm behavior): geocode City.
Entities: NONE detected. Function invocations: none detected. Built-ins: none detected. External hosts in source: nominatim.openstreetmap.org. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getAgentAccountContext
Source: [base44/functions/getAgentAccountContext/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getAgentAccountContext/entry.ts). Purpose (name-based, confirm behavior): get Agent Account Context.
Entities: PlatformConnection, Campaign, PublicProfile, FollowedCampaign, SocialPost, DistributedPost, CommunityMember, AgentDelegation, AgentContentDraft, PostInterest. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getAgentMailContext
Source: [base44/functions/getAgentMailContext/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getAgentMailContext/entry.ts). Purpose (name-based, confirm behavior): get Agent Mail Context.
Entities: PlatformAccessRegistry, InboxItem. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getAppUserConnector
Source: [base44/functions/getAppUserConnector/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getAppUserConnector/entry.ts). Purpose (name-based, confirm behavior): get App User Connector.
Entities: NONE detected. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getBufferReadiness
Source: [base44/functions/getBufferReadiness/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getBufferReadiness/entry.ts). Purpose (name-based, confirm behavior): get Buffer Readiness.
Entities: NONE detected. Function invocations: none detected. Built-ins: none detected. External hosts in source: api.buffer.com. Secret **names only**: BUFFER_API_KEY, BUFFER_CLIENT_ID, BUFFER_CLIENT_SECRET. Other callers: UNKNOWN pending frontend search.

## getCampaignDonations
Source: [base44/functions/getCampaignDonations/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getCampaignDonations/entry.ts). Purpose (name-based, confirm behavior): get Campaign Donations.
Entities: Campaign, Donation. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getCampaignDraft
Source: [base44/functions/getCampaignDraft/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getCampaignDraft/entry.ts). Purpose (name-based, confirm behavior): get Campaign Draft.
Entities: Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getCampaignWithdrawalBalance
Source: [base44/functions/getCampaignWithdrawalBalance/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getCampaignWithdrawalBalance/entry.ts). Purpose (name-based, confirm behavior): get Campaign Withdrawal Balance.
Entities: Campaign, Donation, HoldingLedgerEntry. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getCommunityFeed
Source: [base44/functions/getCommunityFeed/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getCommunityFeed/entry.ts). Purpose (name-based, confirm behavior): get Community Feed.
Entities: ActivityEvent, FollowedCampaign, Campaign. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getConnectedPayoutAccount
Source: [base44/functions/getConnectedPayoutAccount/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getConnectedPayoutAccount/entry.ts). Purpose (name-based, confirm behavior): get Connected Payout Account.
Entities: ConnectedPayoutAccount. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: STRIPE_SECRET_KEY. Other callers: UNKNOWN pending frontend search.

## getCryptoDonationReadiness
Source: [base44/functions/getCryptoDonationReadiness/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getCryptoDonationReadiness/entry.ts). Purpose (name-based, confirm behavior): get Crypto Donation Readiness.
Entities: NONE detected. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.

## getFeatureAvailability
Source: [base44/functions/getFeatureAvailability/entry.ts](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/functions/getFeatureAvailability/entry.ts). Purpose (name-based, confirm behavior): get Feature Availability.
Entities: FeatureFlag. Function invocations: none detected. Built-ins: none detected. External hosts in source: none detected. Secret **names only**: none detected. Other callers: UNKNOWN pending frontend search.
