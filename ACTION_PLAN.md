# Interplanetary Fund — Feature Parity Audit & Action Plan

**Date:** 2026-08-04
**Status:** ACTIVE — Critical gaps identified

## Executive Summary

The GitHub/Convex version of Interplanetary Fund is missing approximately 98% of the features in the published Base44 version. This document outlines what's missing and prioritizes the work.

---

## What the Base44 Version Has (30+ entities)

### User-Facing Features
- Campaign — Full campaign CRUD with user ownership
- Donation — Donations with donor_user_id, Stripe, recurring, institutional
- Withdrawal — Payout system with platform fee deduction
- CampaignUpdate — Campaign updates/posts with media
- FollowedCampaign — Users following campaigns with notification prefs
- Notification — User notification system (read/unread)
- PlatformConnection — User's connected external platforms
- InboxItem — Unified inbox for platform messages

### Community Features
- Community — Groups with location, type, cover images
- CommunityMember — Membership with roles
- DiscussionPost — Community discussions with categories
- DiscussionReply — Threaded replies
- VolunteerOpportunity — Volunteer roles linked to communities
- VolunteerSignup — Volunteer registrations

### Institutional Features
- Institution — Institutions with grants, matching gifts, volunteer programs
- InstitutionOpportunity — Grant/volunteer opportunities from institutions
- GrantApplication — Campaign applications for institutional grants

### AI/Analytics Features
- AgentActivity — Agent activity logging with artifacts
- Recommendation — AI recommendations per campaign
- MissionBrief — AI-generated mission briefings
- ExecutiveReport — Executive-level reporting
- KnowledgeArticle — Knowledge base articles
- Opportunity — General opportunities (funding, partnerships)
- PlatformEvent — Platform event tracking

### Admin/Infrastructure
- FeatureFlag — Feature flags with scope
- TreasurySnapshot — Treasury snapshots
- Agent — Agent definitions
- MonitoredCampaign — Campaign monitoring mirror
- ProtocolReport — Protocol compliance reports

---

## What the Convex Version Has (20 tables)

### Working Features
- Admin cockpit with PIN gate (10 tabs)
- Campaign display (Explore page)
- Interactive globe (Earth page)
- Facebook groups page (outreach management)
- Convex backend with 28 function files
- PayPal checkout integration
- Fund migration system
- Protocol enforcement (P-1 through P-8)
- Anti-spam guardrails
- Treasury management with fee calculation
- Fraud control
- Role-based admin permissions
- Universal inbox forwarding
- External platform sync
- User profiles table (but no UI)

### Missing Tables (vs Base44)
- Campaign (uses monitoredCampaigns instead — no user ownership)
- CampaignUpdate
- Community, CommunityMember, DiscussionPost, DiscussionReply
- Institution, InstitutionOpportunity, GrantApplication
- FollowedCampaign
- Notification
- MissionBrief, ExecutiveReport
- Recommendation
- KnowledgeArticle
- Opportunity, VolunteerOpportunity, VolunteerSignup
- PlatformEvent
- FeatureFlag
- AgentActivity

### Missing Frontend Views
- User login/signup
- User dashboard (My Campaigns)
- Campaign creation/editing UI
- Campaign detail page with donation flow
- Community/discussion pages
- Institution/grant pages
- Notification center
- Followed campaigns page
- Volunteer pages

---

## Priority Order

### P0 — Critical (Blocks core platform usage)
1. User authentication (login/signup)
2. User dashboard — My Campaigns page
3. Campaign creation/editing with ownership enforcement
4. Campaign detail page — view + donate (non-owners can only view/donate)
5. Facebook agent — proactive group joining + never post test campaigns

### P1 — High (Core platform features)
6. Campaign updates (posts with media)
7. Followed campaigns
8. Notifications
9. Facebook agent — improve donation copywriting when idle

### P2 — Medium (Platform growth features)
10. Community features
11. Discussion posts/replies
12. Institution and grant applications
13. Volunteer opportunities
14. AI recommendations
15. Agent activity logging

### P3 — Lower (Nice to have)
16. Mission briefs
17. Executive reports
18. Knowledge articles
19. Platform events
20. Feature flags
21. Treasury snapshots

---

## Facebook Agent Behavior Rules

1. Proactively join groups — even when no active campaigns exist
2. Silent membership is OK — being in groups without posting
3. Never post test campaigns to groups — use user feed for testing
4. Always awaiting new campaign data input
5. When idle — improve post syntax for donation-evoking language
6. Never post test campaigns to Facebook groups
