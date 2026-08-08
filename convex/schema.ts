/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // AGENTS
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    purpose: v.string(),
    description: v.string(),
    capabilities: v.array(v.string()),
    specialization: v.string(),
    knowledgeAreas: v.array(v.string()),
    trustScore: v.number(),
    reliabilityScore: v.number(),
    efficiencyScore: v.number(),
    collaborationScore: v.number(),
    permissions: v.array(v.string()),
    responsibilities: v.array(v.string()),
    toolsAvailable: v.array(v.string()),
    allowedActions: v.array(v.string()),
    approvalRequired: v.boolean(),
    dataAccessLevel: v.string(),
    limitations: v.optional(v.array(v.string())),
    restrictedActions: v.array(v.string()),
    workflowAccess: v.array(v.string()),
    workingMemory: v.array(v.string()),
    longTermMemory: v.array(v.string()),
    managedCampaigns: v.array(v.string()),
    tasksCompleted: v.number(),
    successfulOutcomes: v.number(),
    failedOutcomes: v.number(),
    status: v.string(),
    version: v.number(),
    accentColor: v.string(),
    // Automation controls — per-agent toggles
    automationEnabled: v.optional(v.boolean()),    // Toggle on/off
    lastAutomationRun: v.optional(v.string()),     // ISO timestamp of last automation cycle
    automationInterval: v.optional(v.string()),    // Human-readable interval (e.g. "4h", "6h", "8h")
  }).index("byRole", ["role"]).index("byStatus", ["status"]),

  // MONITORED CAMPAIGNS
  monitoredCampaigns: defineTable({
    ifCampaignId: v.string(),
    title: v.string(),
    status: v.string(),
    goalAmount: v.number(),
    raisedAmount: v.number(),
    donorCount: v.number(),
    outreachEnabled: v.boolean(),
    aiTone: v.string(),
    aiIdealDonors: v.string(),
    aiInterestedOrgs: v.string(),
    aiPlatforms: v.string(),
    aiPriority: v.string(),
    storyPresent: v.boolean(),
    summary: v.string(),
    category: v.string(),
    endDate: v.string(),
    coverImagePresent: v.boolean(),
    coverImageUrl: v.optional(v.string()),
    paymentActive: v.boolean(),
    lastSynced: v.string(),
    externalRaised: v.optional(v.number()),
    externalDonors: v.optional(v.number()),
    platformCount: v.optional(v.number()),
    frozen: v.optional(v.boolean()),
    frozenReason: v.optional(v.string()),
    frozenAt: v.optional(v.string()),
    ownershipProofStatus: v.optional(v.string()),
    ownershipProofNotes: v.optional(v.string()),
    ownershipProofRequestedAt: v.optional(v.string()),
  }).index("byIfId", ["ifCampaignId"]).index("byStatus", ["status"]),

  // PROTOCOL REPORTS
  protocolReports: defineTable({
    reportType: v.string(),
    auditDate: v.string(),
    totalCampaigns: v.number(),
    compliantCampaigns: v.number(),
    nonCompliantCampaigns: v.number(),
    totalRaised: v.number(),
    totalGoal: v.number(),
    fundingGap: v.number(),
    totalDonors: v.number(),
    criticalViolations: v.array(v.object({
      standard: v.string(),
      issue: v.string(),
      severity: v.string(),
    })),
    results: v.array(v.object({
      title: v.string(),
      complianceScore: v.number(),
      violations: v.number(),
    })),
    syncPerformed: v.boolean(),
  }).index("byDate", ["auditDate"]),

  // EXTERNAL PLATFORMS
  externalPlatforms: defineTable({
    platform: v.string(),
    kind: v.string(),
    displayName: v.string(),
    campaignId: v.string(),
    externalTotal: v.number(),
    externalDonorCount: v.number(),
    status: v.string(),
    automationMode: v.string(),
    externalUrl: v.string(),
    lastSynced: v.string(),
    lastError: v.string(),
  }).index("byPlatform", ["platform"]).index("byCampaignId", ["campaignId"]),

  // HOLDING ACCOUNTS
  holdingAccounts: defineTable({
    userId: v.string(),
    totalBalance: v.number(),
    totalFeesDeducted: v.number(),
    totalPaidOut: v.number(),
    pendingPayouts: v.number(),
    lastUpdated: v.string(),
    frozen: v.optional(v.boolean()),
  }).index("byUserId", ["userId"]),

  // PAYOUT REQUESTS
  payoutRequests: defineTable({
    userId: v.string(),
    campaignId: v.optional(v.string()),
    campaignTitle: v.optional(v.string()),
    amountRequested: v.number(),
    feeAmount: v.number(),
    netAmount: v.number(),
    payoutMethod: v.string(),
    payoutDestination: v.string(),
    status: v.string(),
    requestedDate: v.string(),
    completedDate: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    adminReviewStatus: v.optional(v.string()),
    adminReviewNote: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.string()),
    // Financial consolidation fields
    idempotencyKey: v.optional(v.string()),              // Prevents duplicate/replayed withdrawals
    providerTransactionId: v.optional(v.string()),       // External provider's transaction ID
    ledgerEntryId: v.optional(v.string()),               // Reference to campaignLedger entry
    connectedAccountId: v.optional(v.string()),          // Which connected account was used
    authorizationId: v.optional(v.string()),              // Which authorization was used
  }).index("byUserId", ["userId"]).index("byStatus", ["status"]).index("byIdempotency", ["idempotencyKey"]),




  // AGENT ACTIVITY LOGGING
  agentActivityLog: defineTable({
    agentName: v.string(),
    agentId: v.optional(v.string()),
    action: v.string(),
    category: v.string(), // "fundraising", "story", "donor", "protocol", "analytics", "treasury", "platform"
    description: v.string(),
    metadata: v.optional(v.string()),
    creditCost: v.optional(v.number()),
    timestamp: v.string(),
  }).index("byAgent", ["agentName"]).index("byCategory", ["category"]).index("byTimestamp", ["timestamp"]),

  // MISSION BRIEFS & EXECUTIVE REPORTS
  missionBriefs: defineTable({
    title: v.string(),
    type: v.string(), // "daily", "weekly", "executive", "ad_hoc"
    author: v.string(), // "Solene", "system", agent name
    summary: v.string(),
    metrics: v.optional(v.string()), // JSON string of key metrics
    actionItems: v.optional(v.string()), // JSON array of action items
    status: v.string(), // "draft", "published", "archived"
    createdAt: v.string(),
    publishedAt: v.optional(v.string()),
  }).index("byType", ["type"]).index("byStatus", ["status"]),

  // FEATURE FLAGS
  featureFlags: defineTable({
    name: v.string(),
    description: v.string(),
    enabled: v.boolean(),
    rolloutPercent: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("byName", ["name"]),

  // TREASURY SNAPSHOTS
  treasurySnapshots: defineTable({
    totalRaised: v.number(),
    totalDistributed: v.number(),
    totalFees: v.number(),
    totalHeld: v.number(),
    campaignCount: v.number(),
    donorCount: v.number(),
    snapshotDate: v.string(),
    breakdown: v.optional(v.string()), // JSON string
  }).index("byDate", ["snapshotDate"]),

  // INSTITUTION & GRANT APPLICATIONS
  institutionApplications: defineTable({
    institutionName: v.string(),
    contactName: v.string(),
    contactEmail: v.string(),
    type: v.string(), // "nonprofit", "school", "religious", "government", "other"
    description: v.string(),
    requestedAmount: v.number(),
    campaignId: v.optional(v.string()),
    status: v.string(), // "pending", "under_review", "approved", "rejected"
    submittedAt: v.string(),
    reviewedAt: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
  }).index("byStatus", ["status"]).index("byCampaignId", ["campaignId"]),

  // VOLUNTEER OPPORTUNITIES
  volunteerOpportunities: defineTable({
    campaignId: v.string(),
    campaignTitle: v.string(),
    title: v.string(),
    description: v.string(),
    location: v.string(), // "remote" or city/country
    timeCommitment: v.string(), // "one-time", "weekly", "flexible"
    skills: v.array(v.string()),
    maxVolunteers: v.number(),
    currentVolunteers: v.number(),
    postedBy: v.string(),
    postedAt: v.string(),
    status: v.string(), // "open", "filled", "closed"
  }).index("byCampaignId", ["campaignId"]).index("byStatus", ["status"]),

  volunteerSignups: defineTable({
    opportunityId: v.string(),
    userId: v.string(),
    userName: v.string(),
    userEmail: v.string(),
    message: v.optional(v.string()),
    status: v.string(), // "pending", "accepted", "declined"
    signedUpAt: v.string(),
  }).index("byOpportunityId", ["opportunityId"]).index("byUserId", ["userId"]),

  // COMMUNITY FEATURES
  communityGroups: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(),
    createdBy: v.string(),
    memberCount: v.number(),
    createdAt: v.string(),
  }).index("byCategory", ["category"]).index("byCreatedBy", ["createdBy"]),

  groupMembers: defineTable({
    groupId: v.string(),
    userId: v.string(),
    joinedAt: v.string(),
  }).index("byGroupId", ["groupId"]).index("byUserId", ["userId"]),

  discussions: defineTable({
    groupId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    title: v.string(),
    content: v.string(),
    replyCount: v.number(),
    createdAt: v.string(),
  }).index("byGroupId", ["groupId"]).index("byAuthorId", ["authorId"]),

  discussionReplies: defineTable({
    discussionId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    content: v.string(),
    createdAt: v.string(),
  }).index("byDiscussionId", ["discussionId"]),

  // TRANSACTIONS
  transactions: defineTable({
    userId: v.string(),
    type: v.string(),
    amount: v.number(),
    sourcePlatform: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    payoutRequestId: v.optional(v.string()),
    status: v.string(),
    createdAt: v.string(),
    // Financial consolidation fields
    providerTransactionId: v.optional(v.string()),
    ledgerEntryId: v.optional(v.string()),
    reconciliationStatus: v.optional(v.string()),
  }).index("byUserId", ["userId"]).index("byType", ["type"]).index("byCampaign", ["campaignId"]),

  // DONATIONS
  donations: defineTable({
    campaignId: v.string(),
    campaignTitle: v.string(),
    amount: v.number(),
    donorName: v.string(),
    donorEmail: v.optional(v.string()),
    message: v.optional(v.string()),
    paymentMethod: v.string(),
    status: v.string(),
    txnId: v.optional(v.string()),
    createdAt: v.string(),
  }).index("byCampaignId", ["campaignId"]).index("byStatus", ["status"]),

  // SUPPORTER INTERACTIONS
  supporterInteractions: defineTable({
    campaignId: v.string(),
    campaignTitle: v.string(),
    interactionType: v.string(),
    supporterName: v.optional(v.string()),
    supporterId: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.string(),
  }).index("byCampaignId", ["campaignId"]).index("byType", ["interactionType"]),

  // EMAIL SUBSCRIBERS — Newsletter / mailing list for retargeting
  emailSubscribers: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    source: v.optional(v.string()),        // "footer", "campaign_page", "exit_intent"
    interestedIn: v.optional(v.array(v.string())),  // campaign categories they care about
    isActive: v.boolean(),                   // soft opt-out
    subscribedAt: v.string(),
    unsubscribedAt: v.optional(v.string()),
  }).index("byEmail", ["email"]).index("byActive", ["isActive"]),

  // FEE CONFIGURATION
  feeConfig: defineTable({
    platformFeePercent: v.number(),
    processingFeePercent: v.number(),
    processingFeeFlat: v.number(),
    active: v.optional(v.boolean()),
    adminPin: v.optional(v.string()),
    updatedBy: v.string(),
    updatedAt: v.string(),
  }),

  // FACEBOOK CONNECTIONS
  facebookConnections: defineTable({
    userId: v.string(),
    facebookUserId: v.string(),
    facebookUserName: v.string(),
    accessToken: v.string(),
    permissions: v.array(v.string()),
    connectedAt: v.string(),
    status: v.string(),
  }).index("byUserId", ["userId"]).index("byStatus", ["status"]),

  // DISCOVERED FACEBOOK GROUPS
  facebookGroups: defineTable({
    campaignId: v.string(),
    campaignTitle: v.string(),
    campaignCategory: v.string(),
    groupFacebookId: v.string(),
    groupName: v.string(),
    groupUrl: v.string(),
    memberCount: v.number(),
    groupCategory: v.string(),
    groupDescription: v.string(),
    relevanceScore: v.number(),
    joinStatus: v.string(),
    joinedAt: v.optional(v.string()),
    canPost: v.boolean(),
    postsCount: v.number(),
    lastPostedAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
    discoveredAt: v.string(),
    joinQuestionnaire: v.optional(v.string()),
    questionnaireAnswers: v.optional(v.string()),
    questionnaireStatus: v.optional(v.string()),
  }).index("byCampaignId", ["campaignId"]).index("byJoinStatus", ["joinStatus"]),

  // FACEBOOK GROUP POSTS
  facebookGroupPosts: defineTable({
    campaignId: v.string(),
    campaignTitle: v.string(),
    groupId: v.string(),
    groupFacebookId: v.string(),
    groupName: v.string(),
    postType: v.string(),
    postContent: v.string(),
    postUrl: v.optional(v.string()),
    postStatus: v.string(),
    scheduledFor: v.optional(v.string()),
    postedAt: v.optional(v.string()),
    reactions: v.number(),
    comments: v.number(),
    shares: v.number(),
    error: v.optional(v.string()),
    createdAt: v.string(),
  }).index("byCampaignId", ["campaignId"]).index("byGroupId", ["groupId"]).index("byStatus", ["postStatus"]),

  // ACCOUNTS CREATED
  accountsCreated: defineTable({
    platform: v.string(),
    accountEmail: v.string(),
    accountName: v.string(),
    purpose: v.string(),
    campaignId: v.optional(v.string()),
    credentialsStored: v.boolean(),
    createdAt: v.string(),
    reported: v.boolean(),
    reportDate: v.optional(v.string()),
  }).index("byReported", ["reported"]).index("byPlatform", ["platform"]),

  // SPAM BLOCKLIST
  spamBlocklist: defineTable({
    identifier: v.string(),
    identifierType: v.string(),
    reason: v.string(),
    platform: v.string(),
    blockedAt: v.string(),
  }).index("byIdentifier", ["identifier"]).index("byPlatform", ["platform"]),

  // UNIVERSAL INBOX — all platform messages in one place
  universalInbox: defineTable({
    platform: v.string(),
    senderName: v.string(),
    senderId: v.string(),
    recipientId: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
    platformMessageId: v.string(),
    platformUrl: v.optional(v.string()),
    groupId: v.optional(v.string()),
    groupName: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    status: v.string(),        // "new", "read", "replied", "archived"
    forwarded: v.boolean(),
    forwardedAt: v.optional(v.string()),
    replied: v.boolean(),
    repliedAt: v.optional(v.string()),
    replyContent: v.optional(v.string()),
    priority: v.string(),      // "high", "normal", "low"
    receivedAt: v.string(),
  }).index("byStatus", ["status"]).index("byPlatform", ["platform"]).index("byReceivedAt", ["receivedAt"]),

  // DISTRIBUTED POSTS — cross-platform published content
  distributedPosts: defineTable({
    campaignId: v.string(),
    campaignTitle: v.string(),
    platform: v.string(),
    postType: v.string(),
    content: v.string(),
    imageUrl: v.optional(v.string()),
    paypalLink: v.optional(v.string()),
    postUrl: v.optional(v.string()),
    status: v.string(),
    scheduledFor: v.optional(v.string()),
    postedAt: v.optional(v.string()),
    reactions: v.optional(v.number()),
    comments: v.optional(v.number()),
    shares: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.string(),
  }).index("byCampaignId", ["campaignId"]).index("byPlatform", ["platform"]).index("byStatus", ["status"]),


  // USER PROFILES — tracks user account settings, AI toggles, admin access
  userProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    subscriptionTier: v.string(),        // "standard" | "campaign_manager"
    aiCrossPostingEnabled: v.boolean(),   // Campaign Manager Package — AI posts to Michelle's linked accounts
    standardCrossPostingEnabled: v.boolean(),  // Standard — cross-post to user's own linked accounts (half frequency)
    adminAccessStatus: v.string(),        // "none" | "requested" | "granted" | "denied" | "revoked"
    adminAccessRequestedAt: v.optional(v.string()),
    adminAccessGrantedAt: v.optional(v.string()),
    // Onboarding state
    onboardingCompleted: v.optional(v.boolean()),
    onboardingStep: v.optional(v.string()),   // "welcome" | "profile" | "preferences" | "first_campaign" | "done"
    onboardingCompletedAt: v.optional(v.string()),
    // Communication preferences
    emailNotifications: v.optional(v.boolean()),
    donationAlerts: v.optional(v.boolean()),
    campaignUpdates: v.optional(v.boolean()),
    marketingEmails: v.optional(v.boolean()),
    smsNotifications: v.optional(v.boolean()),
    // Profile metadata
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    socialLinks: v.optional(v.string()),    // JSON string of { platform: url }
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("byUserId", ["userId"]).index("byTier", ["subscriptionTier"]),

  // ADMIN USERS — role-based access control
  adminUsers: defineTable({
    name: v.string(),
    email: v.string(),
    pin: v.string(),
    role: v.string(),          // "super_admin" | "admin"
    permissions: v.array(v.string()),  // ["finance", "campaigns", "platforms", "content", "settings", "reports"]
    active: v.boolean(),
    createdBy: v.string(),
    createdAt: v.string(),
    lastLoginAt: v.optional(v.string()),
  }).index("byPin", ["pin"]).index("byEmail", ["email"]),

// Admin settings (security PIN, config)
  adminSettings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.string(),
  }).index("byKey", ["key"]),
  // USER CAMPAIGNS — campaigns created by users, with ownership
  userCampaigns: defineTable({
    userId: v.string(),
    title: v.string(),
    summary: v.string(),
    story: v.string(),
    category: v.string(),
    goalAmount: v.number(),
    raisedAmount: v.number(),
    donorCount: v.number(),
    status: v.string(),
    coverImageUrl: v.optional(v.string()),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    beneficiary: v.optional(v.string()),
    timeline: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()),
    cashappTag: v.optional(v.string()),
    outreachEnabled: v.boolean(),
    // AI-generated content (from AI Campaign Wizard)
    aiFaq: v.optional(v.string()),
    aiSocialCaptions: v.optional(v.string()),       // JSON array of {platform, caption}
    aiPressRelease: v.optional(v.string()),
    aiDonorThankYou: v.optional(v.string()),
    aiSeoContent: v.optional(v.string()),
    aiImagePrompt: v.optional(v.string()),
    aiTags: v.optional(v.array(v.string())),
    aiGenerated: v.optional(v.boolean()),            // true if created via AI wizard
    // Financial consolidation & automation fields
    automationEnabled: v.optional(v.boolean()),         // AI campaign management toggle
    automationConsentId: v.optional(v.string()),         // Reference to automationConsents._id
    connectedAccountIds: v.optional(v.array(v.string())),// Connected account IDs for this campaign
    lastConsolidationAt: v.optional(v.string()),         // Last fund consolidation timestamp
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("byUserId", ["userId"]).index("byStatus", ["status"]),

  // CAMPAIGN UPDATES
  campaignUpdates: defineTable({
    campaignId: v.string(),
    title: v.string(),
    content: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    createdAt: v.string(),
  }).index("byCampaignId", ["campaignId"]),

  // FOLLOWED CAMPAIGNS
  followedCampaigns: defineTable({
    userId: v.string(),
    campaignId: v.string(),
    campaignTitle: v.string(),
    category: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    pinned: v.boolean(),
    archived: v.boolean(),
    lastViewed: v.optional(v.string()),
    createdAt: v.string(),
  }).index("byUserId", ["userId"]).index("byCampaignId", ["campaignId"]),

  // NOTIFICATIONS
  notifications: defineTable({
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    type: v.string(),
    link: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.string(),
  }).index("byUserId", ["userId"]).index("byRead", ["read"]),


  // Comments on campaigns (integrated from fundforge/)
  comments: defineTable({
    campaignId: v.string(),
    authorName: v.string(),
    authorId: v.optional(v.string()),
    content: v.string(),
    likes: v.number(),
    likedBy: v.array(v.string()),
    createdAt: v.string(),
  }).index("byCampaign", ["campaignId"]),

  // Saved/bookmarked campaigns (integrated from fundforge/)
  savedCampaigns: defineTable({
    userId: v.string(),
    campaignId: v.string(),
    campaignTitle: v.string(),
    savedAt: v.string(),
  }).index("byUser", ["userId"]),

  // Support tickets (integrated from fundforge/)
  supportTickets: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    status: v.string(),
    createdAt: v.string(),
  }).index("byStatus", ["status"]),

  // Help articles (integrated from fundforge/)
  helpArticles: defineTable({
    category: v.string(),
    question: v.string(),
    answer: v.string(),
    helpfulYes: v.number(),
    helpfulNo: v.number(),
  }).index("byCategory", ["category"]),


  // ============================================================
  // FINANCIAL CONSOLIDATION SYSTEM — New tables for the
  // campaign-creator delegated authorization, account linkage,
  // financial ledger, fund consolidation, automation consent,
  // audit logging, and universal integration design.
  // ============================================================

  // CONNECTED ACCOUNTS — External payment/funding provider accounts
  // linked to an Interplanetary Fund user. A connected account
  // represents a credential-grant or OAuth link to an external
  // provider (PayPal, Stripe, Cash App, bank, etc.). It does NOT
  // grant the AI any permissions — those are tracked separately in
  // accountAuthorizations.
  connectedAccounts: defineTable({
    userId: v.string(),                  // IF user who owns this connection
    provider: v.string(),                // "paypal" | "stripe" | "cashapp" | "bank" | "gofundme" | ...
    providerAccountId: v.string(),       // External provider's account identifier (email, account ID, etc.)
    providerDisplayName: v.string(),     // Human-readable account label (e.g. "interplanetarysister@gmail.com")
    connectionMethod: v.string(),        // "oauth" | "api_key" | "manual" | "webhook"
    connectionStatus: v.string(),        // "active" | "expired" | "revoked" | "error"
    scopes: v.array(v.string()),         // Provider-specific scopes/permissions granted
    accessToken: v.optional(v.string()), // OAuth access token (encrypted server-side)
    refreshToken: v.optional(v.string()),// OAuth refresh token
    tokenExpiresAt: v.optional(v.string()),
    metadata: v.optional(v.string()),    // JSON string of provider-specific data
    connectedAt: v.string(),
    lastVerifiedAt: v.optional(v.string()),
    revokedAt: v.optional(v.string()),
    revokedReason: v.optional(v.string()),
  }).index("byUserId", ["userId"]).index("byProvider", ["provider"]).index("byStatus", ["connectionStatus"]),

  // ACCOUNT AUTHORIZATIONS — Records of which campaign creator
  // authorized which connected account for which campaign(s).
  // A connected account does NOT automatically mean authorization
  // for any campaign. Each authorization is explicit, scoped, and
  // revocable.
  accountAuthorizations: defineTable({
    userId: v.string(),                   // The campaign creator who granted this authorization
    campaignId: v.string(),               // The campaign this authorization applies to
    connectedAccountId: v.string(),        // Reference to connectedAccounts._id
    provider: v.string(),                  // Provider type for quick reference
    permissions: v.array(v.string()),     // ["read_transactions", "sync_funds", "initiate_payout", ...]
    authorizationScope: v.string(),        // "read_only" | "full_management" | "sync_and_reconcile"
    status: v.string(),                    // "active" | "revoked" | "expired"
    grantedAt: v.string(),
    revokedAt: v.optional(v.string()),
    revokedReason: v.optional(v.string()),
    expiresAt: v.optional(v.string()),     // Optional expiry
    agreementVersion: v.optional(v.string()),// Version of consent agreement accepted
  }).index("byUserId", ["userId"]).index("byCampaignId", ["campaignId"]).index("byConnectedAccount", ["connectedAccountId"]).index("byStatus", ["status"]),

  // CAMPAIGN LEDGER — Per-campaign financial ledger entries.
  // Every financial event for a campaign is recorded here as an
  // immutable ledger entry. This is the source of truth for
  // campaign finances — NOT client-side balances.
  campaignLedger: defineTable({
    campaignId: v.string(),
    userId: v.string(),                   // Campaign owner
    entryType: v.string(),                // "donation" | "refund" | "chargeback" | "fee" | "payout" | "adjustment" | "consolidation"
    amount: v.number(),                   // Positive for credits, negative for debits
    grossAmount: v.optional(v.number()),   // For donations: gross before fees
    platformFee: v.optional(v.number()),   // IF platform fee
    processingFee: v.optional(v.number()), // Payment processor fee
    netAmount: v.optional(v.number()),     // Net after all fees
    provider: v.optional(v.string()),      // "paypal" | "stripe" | "cashapp" | "manual" | ...
    providerTransactionId: v.optional(v.string()), // External provider's transaction ID for deduplication
    connectedAccountId: v.optional(v.string()),
    authorizationId: v.optional(v.string()),
    source: v.string(),                   // "manual" | "webhook" | "consolidation" | "ai_automation"
    initiatedBy: v.string(),              // "user" | "ai_agent" | "system" | "admin"
    description: v.string(),
    status: v.string(),                    // "pending" | "completed" | "failed" | "reversed"
    reconciliationStatus: v.optional(v.string()), // "unreconciled" | "reconciled" | "flagged" | "duplicate"
    relatedEntryId: v.optional(v.string()),// For reversals/chargebacks linked to original entry
    metadata: v.optional(v.string()),     // JSON string of extra data
    createdAt: v.string(),
  }).index("byCampaignId", ["campaignId"]).index("byUserId", ["userId"]).index("byType", ["entryType"]).index("byProviderTxn", ["providerTransactionId"]).index("byStatus", ["status"]),

  // AUTOMATION CONSENTS — Records of explicit user consent for
  // AI-managed campaign automation. Every time a campaign creator
  // enables automated AI campaign management, a consent record is
  // created here. Revocation is also tracked.
  automationConsents: defineTable({
    userId: v.string(),
    campaignId: v.string(),
    agreementVersion: v.string(),          // Version of the consent agreement
    permissions: v.array(v.string()),     // What the AI is allowed to do
    connectedProviders: v.array(v.string()),// Which providers are covered
    automationStatus: v.string(),         // "active" | "revoked" | "paused"
    acceptedAt: v.string(),
    revokedAt: v.optional(v.string()),
    revokedReason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),    // For audit trail
    userAgent: v.optional(v.string()),    // For audit trail
  }).index("byUserId", ["userId"]).index("byCampaignId", ["campaignId"]).index("byStatus", ["automationStatus"]),

  // FINANCIAL AUDIT LOG — Immutable audit trail for all financial
  // actions. Records who did what, when, with what authorization,
  // and the before/after state.
  financialAuditLog: defineTable({
    userId: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    action: v.string(),                   // "connect_account" | "authorize_account" | "consolidate_funds" | "enable_automation" | "disable_automation" | "withdraw" | "reconcile" | ...
    initiatedBy: v.string(),              // "user" | "ai_agent" | "system" | "admin"
    provider: v.optional(v.string()),
    connectedAccountId: v.optional(v.string()),
    authorizationId: v.optional(v.string()),
    transactionAmount: v.optional(v.number()),
    authorizationState: v.string(),       // "authorized" | "unauthorized" | "expired" | "revoked"
    result: v.string(),                   // "success" | "failure" | "partial"
    beforeState: v.optional(v.string()),  // JSON string of state before action
    afterState: v.optional(v.string()),   // JSON string of state after action
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.string()),
    timestamp: v.string(),
  }).index("byUserId", ["userId"]).index("byCampaignId", ["campaignId"]).index("byAction", ["action"]).index("byTimestamp", ["timestamp"]),

  // CONSOLIDATION RUNS — Records of each fund consolidation run.
  // Tracks what was discovered, what was reconciled, what was flagged.
  consolidationRuns: defineTable({
    campaignId: v.string(),
    userId: v.string(),
    initiatedBy: v.string(),              // "user" | "ai_agent" | "system"
    status: v.string(),                   // "running" | "completed" | "failed" | "partial"
    providers: v.array(v.string()),       // Which providers were checked
    connectedAccountIds: v.array(v.string()),
    transactionsDiscovered: v.number(),
    transactionsImported: v.number(),     // New entries added to ledger
    transactionsDuplicate: v.number(),    // Already existed (deduped)
    transactionsFlagged: v.number(),       // Couldn't be confidently attributed
    totalDiscoveredAmount: v.number(),
    totalImportedAmount: v.number(),
    previouslyReconciledAmount: v.number(),
    pendingAmount: v.number(),
    failedAmount: v.number(),
    discrepancies: v.optional(v.array(v.object({
      type: v.string(),
      description: v.string(),
      amount: v.optional(v.number()),
    }))),
    accountsRequiringReauth: v.optional(v.array(v.string())),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("byCampaignId", ["campaignId"]).index("byUserId", ["userId"]).index("byStatus", ["status"]),

  // PROVIDER TRANSACTIONS — Imported transactions from external
  // providers, stored for deduplication and reconciliation. Each
  // has a provider-specific transaction ID to prevent duplicates.
  providerTransactions: defineTable({
    provider: v.string(),                 // "paypal" | "stripe" | "cashapp" | "gofundme" | ...
    providerTransactionId: v.string(),    // External provider's unique transaction ID
    providerAccountId: v.string(),        // Which external account this came from
    connectedAccountId: v.optional(v.string()),
    campaignId: v.optional(v.string()),   // Matched campaign (if any)
    userId: v.optional(v.string()),       // Matched user (if any)
    amount: v.number(),
    currency: v.string(),                 // "USD" by default
    transactionType: v.string(),          // "donation" | "refund" | "chargeback" | "payout" | "fee"
    status: v.string(),                   // "pending" | "completed" | "failed"
    donorName: v.optional(v.string()),
    donorEmail: v.optional(v.string()),
    importedAt: v.string(),
    ledgerEntryId: v.optional(v.string()),// Reference to campaignLedger entry (if reconciled)
    reconciliationStatus: v.string(),     // "pending" | "matched" | "flagged" | "orphaned"
    rawData: v.optional(v.string()),      // JSON string of raw provider data
  }).index("byProvider", ["provider"]).index("byProviderTxnId", ["providerTransactionId"]).index("byCampaignId", ["campaignId"]).index("byReconciliation", ["reconciliationStatus"]),

  // FEE CONFIG — Already exists above, adding index for clarity
  // (No duplicate — this is just a comment marker)


});
