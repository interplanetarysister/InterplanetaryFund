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
  }).index("byUserId", ["userId"]).index("byStatus", ["status"]),




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
  }).index("byUserId", ["userId"]).index("byType", ["type"]),

  // DONATIONS
  donations: defineTable({
    campaignId: v.string(),
    campaignTitle: v.string(),
    amount: v.number(),
    donorName: v.string(),
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

});
