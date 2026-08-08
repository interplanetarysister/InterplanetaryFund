# Interplanetary Fund — Database Schema Map
**Version:** 1.0.0
**Platform:** Convex (rosy-butterfly-2)
**Total Tables:** 47

## Tables

### Agent System (4 tables)
1. agents — 7 AI agents with trust scores, automation toggles, managed campaigns
2. agentActivityLog — Activity logging for all agent actions
3. missionBriefs — Training briefs for agent onboarding
4. featureFlags — Feature toggles

### Campaign System (6 tables)
5. monitoredCampaigns — External campaigns synced from other platforms (5 records)
6. userCampaigns — Campaigns created directly on platform (5 records)
7. campaignUpdates — Campaign update posts
8. followedCampaigns — User follow relationships
9. savedCampaigns — User save/bookmark relationships
10. comments — Campaign comments

### Protocol & Audit (3 tables)
11. protocolReports — Persistent audit history (P-1 through P-8)
12. financialAuditLog — Financial audit trail
13. consolidationRuns — Fund consolidation records

### Treasury & Finance (7 tables)
14. holdingAccounts — Holding account balances (gross/net)
15. payoutRequests — Withdrawal requests
16. transactions — Transaction records
17. donations — Donation records linked to campaigns
18. feeConfig — Fee configuration
19. campaignLedger — Per-campaign financial ledger
20. providerTransactions — External provider transaction records

### External Platforms (6 tables)
21. externalPlatforms — Connected external platforms (11 records)
22. facebookConnections — Facebook account connections
23. facebookGroups — Facebook groups (63 records)
24. facebookGroupPosts — Posts to Facebook groups
25. accountsCreated — Accounts created on external platforms
26. distributedPosts — Cross-platform post distribution

### User System (5 tables)
27. userProfiles — User profiles with admin access
28. adminUsers — Admin user records
29. adminSettings — Admin configuration
30. notifications — User notifications
31. supportTickets — Support ticket system

### Community & Content (6 tables)
32. communityGroups — Community groups
33. groupMembers — Group membership
34. discussions — Discussion threads
35. discussionReplies — Discussion replies
36. volunteerOpportunities — Volunteer listings
37. volunteerSignups — Volunteer registrations

### Support & Help (3 tables)
38. helpArticles — Help center articles
39. institutionApplications — Institution applications
40. supporterInteractions — Supporter interaction records

### Security & Anti-Spam (3 tables)
41. spamBlocklist — Spam blocking list
42. universalInbox — Universal inbox
43. connectedAccounts — Connected external accounts

### Automation & Auth (4 tables)
44. accountAuthorizations — Account authorization records
45. automationConsents — User automation consent records
46. treasurySnapshots — Treasury snapshot history
47. emailSubscribers — Email subscriber list

## Key Indexes
- agents: byRole, byStatus
- monitoredCampaigns: byIfId, byStatus
- userCampaigns: byUserId, byStatus
- donations: byCampaignId
- protocolReports: byAuditDate
- transactions: byCampaignId, byDate

## Schema Source
- File: convex/schema.ts (808 lines)
- Deployed to: rosy-butterfly-2.convex.cloud
