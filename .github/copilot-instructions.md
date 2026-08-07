# GitHub Copilot Instructions — Interplanetary Fund

## Project Overview
The Interplanetary Fund is a woman-owned fundraising platform built by Michelle Rogers. It streamlines fundraising, manages donor relationships, and maximizes campaign impact through AI agents and real-time insights. The platform is built on Base44 (primary app), with a credit-free Convex backend for analytics and automation, and a React frontend for dashboards.

## Architecture — THREE Connected Systems

### 1. Base44 App (Primary — Source of Truth)
- **App ID**: 6a67a778342a8fe05ee79cba
- **URL**: base44-dispatcher-production.base44.workers.dev
- **Description**: AI-powered operating system for organizers and nonprofits
- **30+ Entities**: Campaign, Donation, Community, Institution, GrantApplication, AgentActivity, Institution, Notification, PlatformConnection, PlatformEvent, FeatureFlag, Opportunity, KnowledgeArticle, CampaignUpdate, MissionBrief, VolunteerOpportunity, Withdrawal, ExecutiveReport, CommunityMember, DiscussionPost, Message, DistributedPost, DiscussionReply, InstitutionOpportunity, InboxItem, FollowedCampaign, Recommendation

### 2. Convex Backend (Credit-Free Analytics & Automation)
- **URL**: https://rosy-butterfly-2.convex.cloud
- **REST API**: POST https://rosy-butterfly-2.convex.cloud/api/query
- **Purpose**: Mirrors Base44 data for credit-free analytics, protocol enforcement, and automation
- **8 Tables**: agents, monitoredCampaigns, protocolReports, externalPlatforms, holdingAccounts, payoutRequests, transactions, feeConfig
- **Crons**: Daily 6am audit, weekly Saturday 2am training

### 3. React Frontend (Dashboard)
- **Framework**: React + Vite + Tailwind CSS
- **Hosting**: Vercel (auto-deploy from GitHub)
- **Mobile**: Capacitor wrapper for Android APK
- **Purpose**: Analytics dashboard showing live data from Convex

## Data Flow
```
Base44 App (source of truth) 
  → Base44 backend function (syncConvexData) 
  → Convex REST API 
  → Convex tables (mirror) 
  → React dashboard (reads from Convex)
```

## 4 Built-in AI Agents (from Base44 App)
These agents are built into the Base44 app's architecture by the Builder AI. They generate recommendations, mission briefs, and distributed posts.

| Agent | Role | Specialization |
|-------|------|----------------|
| Strategy Agent | strategy | Campaign activation, protocol compliance, milestones |
| Story Agent | story | Narrative optimization, SEO, conversion |
| Growth Agent | growth | Donor acquisition, social proof, seed funding |
| Communications Agent | communications | Multi-platform outreach, content distribution |

## 5 Campaigns (Real Data from Base44)
| Campaign | Status | Category | Goal | External Raised |
|----------|--------|----------|------|-----------------|
| Running against the wind | draft | disaster_relief | $5,000 | $0 |
| Random tester | active | creative | $1,000 | $500 (Patreon) |
| Help | active | emergency | $5,000 | $9,000 (Buy Me a Coffee) |
| Woman with a dream | active | business | $50,000 | $330 (Ko-fi, Spotfund) |
| Help homeless get a conversion van | draft | housing | $10,000 | $0 |
| **TOTAL** | | | **$71,000** | **$9,830** |

## 11 Platform Connections (Real Data from Base44)
Bluesky (social, auto, published), Patreon ($500, 2 donors), Facebook (social, auto), Ko-fi ($250), Buy Me a Coffee ($9,000, 4 donors), Spotfund ($80), FundRazr, Indiegogo, GiveSendGo, Kickstarter, GoFundMe

## 10 Funding Opportunities (Real Data from Base44)
Grants.gov, IFundWomen Universal Grant, Amber Grant for Women ($10K monthly / $50K annual), 37 Angels ($50K-$200K), Skip Instant Grants

## Convex Backend Files
- `convex/schema.ts` — 8 tables matching Base44 data structure
- `convex/agents.ts` — Agent CRUD, stats, memory updates
- `convex/campaigns.ts` — Campaign sync, platform connections
- `convex/treasury.ts` — Fees, payouts, balance aggregation
- `convex/protocol.ts` — P-1 through P-8 enforcement, auto-fix
- `convex/crons.ts` — Daily audit + weekly training
- `convex/seed.ts` — Seeds real data from Base44 app (4 agents, 5 campaigns, 11 platforms)

## Protocol Standards (P-1 through P-8)
- P-1: outreach_enabled = true
- P-2: payment_active = true
- P-3: story_present = true
- P-4: cover_image_present = true
- P-5: ai_ideal_donors or ai_interested_orgs not empty
- P-6: Daily protocol audit enforced via cron
- P-7: Gross-to-net fee calculation for all deposits
- P-8: Batch payout processing with fee deduction

## Key Conventions
- All currency values stored as floats (USD)
- Dates in ISO 8601 format
- Agent scores: trustScore, reliabilityScore, efficiencyScore (0-100)
- Campaign status: "active" | "draft" | "completed" | "archived"
- Mobile-first: all UI must work on Galaxy A16 (360x800 viewport)
- Dark theme with agent-specific accent colors

## Build Commands
- `npm run dev` — local development with Convex
- `npm run build` — production build to dist/
- `npm run preview` — preview production build
- `npx convex dev` — run Convex backend locally
- `npx convex deploy` — deploy Convex to production
- `npx cap sync` — sync web build to Capacitor (mobile)
- `npx cap open android` — open Android Studio project

## Environment Variables
- `VITE_CONVEX_URL` — Convex deployment URL (https://rosy-butterfly-2.convex.cloud)
