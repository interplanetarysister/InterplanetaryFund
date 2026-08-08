# Interplanetary Fund — Backend Architecture Map
**Version:** 1.0.0
**Platform:** Convex (rosy-butterfly-2)
**Total Functions:** 64 files

## Function Categories

### Authentication & Users (4 files)
- convex/auth.ts — Legacy auth system
- convex/userAuth.ts — Passwordless email auth (register, login, getProfile)
- convex/userManagement.ts — User management functions
- convex/adminUsers.ts — Admin user management

### Campaign Management (8 files)
- convex/campaigns.ts — Monitored campaigns CRUD + external platform sync
- convex/userCampaigns.ts — User campaign CRUD with ownership enforcement
- convex/campaignDefaults.ts — Campaign default values
- convex/campaignLedger.ts — Per-campaign financial ledger
- convex/fixCampaignStatus.ts — Campaign status repair
- convex/fixPublishing.ts — Publishing state repair
- convex/syncRaisedAmounts.ts — Raised amount synchronization
- convex/syncToUserCampaigns.ts — Sync to user campaigns table

### Protocol & Audit (4 files)
- convex/protocol.ts — Protocol enforcement (P-1 through P-8)
- convex/protocolAutoFix.ts — Auto-fix non-compliant campaigns
- convex/financialAudit.ts — Financial audit functions
- convex/fraudControl.ts — Fraud detection and control

### Treasury & Finance (8 files)
- convex/treasury.ts — Treasury management (holding accounts, payouts)
- convex/secureWithdraw.ts — Secure withdrawal with admin PIN
- convex/simpleWithdraw.ts — Simple withdrawal
- convex/withdrawalMethods.ts — Withdrawal method management
- convex/fundConsolidation.ts — Fund consolidation engine
- convex/fundMigration.ts — Fund migration from external platforms
- convex/paymentProviders.ts — Payment provider config
- convex/financialAudit.ts — Financial audit log

### Payments (4 files)
- convex/paypalCheckout.ts — PayPal checkout flow
- convex/paypalWebhook.ts — PayPal webhook handler
- convex/stripeCheckout.ts — Stripe checkout session
- convex/stripeWebhook.ts — Stripe webhook handler

### Agent System (6 files)
- convex/agents.ts — Agent CRUD and management
- convex/agentAutomation.ts — Per-agent automation cycles
- convex/agentOnboarding.ts — Agent onboarding and briefings
- convex/agentOps.ts — Agent operations
- convex/reconfigureAgents.ts — Agent reconfiguration
- convex/updateAgentMemory.ts — Agent memory updates

### AI & Content (3 files)
- convex/aiCampaignGen.ts — AI campaign content generation
- convex/imageGen.ts — Image generation via Pollinations.ai
- convex/postContent.ts — Auto post content generation

### External Platforms (5 files)
- convex/facebook.ts — Facebook group management (63 groups)
- convex/outreach.ts — Outreach strategy
- convex/fixPlatforms.ts — Platform repair
- convex/cleanupPlatforms.ts — Platform cleanup
- convex/connectedAccounts.ts — Connected account management

### Infrastructure (7 files)
- convex/crons.ts — All cron job definitions (12+ jobs)
- convex/http.ts — HTTP API routes
- convex/autonomous.ts — Autonomous operations (health check, auto-repair)
- convex/research.ts — Agent research sprints
- convex/browserbase.ts — Browser-based research via Browserbase
- convex/security.ts — Security functions
- convex/seed.ts — Data seeding

### Community & Support (5 files)
- convex/community.ts — Community groups and discussions
- convex/comments.ts — Comments system
- convex/support.ts — Support ticket system
- convex/emailSystem.ts — Email system (needs Resend API key)
- convex/emailCapture.ts — Email capture/subscribers

### Other (10 files)
- convex/inbox.ts — Universal inbox
- convex/institutions.ts — Institution applications
- convex/interactions.ts — Supporter interactions
- convex/antiSpam.ts — Anti-spam system
- convex/automationConsent.ts — Automation consent management
- convex/savedCampaigns.ts — Saved campaigns
- convex/accountTracker.ts — Account tracking
- convex/volunteer.ts — Volunteer system
- convex/seedHelp.ts — Help article seeding
- convex/seedNewFeatures.ts — New feature seeding

## Cron Jobs (12+)
1. Daily Protocol Auto-Fix — 6am PT (13:00 UTC)
2. Weekly Training — Saturday 2am PT (09:00 UTC)
3. Daily Post Generation — 8am PT (15:00 UTC)
4. Proactive Group Discovery — Every 4 hours
5. Outreach Strategy Improvement — Every 6 hours
6. Site Health Monitor — Every hour
7. Auto-Repair — Every 6 hours
8. Agent Research Sprint — Every 12 hours
9. Browserbase Research — Every 6 hours
10. Atlas Facebook Automation — Every 4 hours
11. Post Production Automation — Every 6 hours
12. Donor Relations Automation — Every 6 hours
13. Scout Automation — Every 8 hours
14. Coordinator Automation — Every 4 hours
15. Master Agent Check — Every 2 hours
