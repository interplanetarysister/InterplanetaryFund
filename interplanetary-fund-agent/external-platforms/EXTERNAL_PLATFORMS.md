# Interplanetary Fund — External Platforms
**Version:** 1.0.0

## Connected Platforms (11)
- Stored in: externalPlatforms table
- Managed via: convex/campaigns.ts (connectExternalPlatform, getExternalPlatforms, getAllExternalBalances)
- Dashboard: src/pages/PlatformDashboard.tsx

## Facebook Groups (63)
- Stored in: facebookGroups table
- Managed via: convex/facebook.ts
- Posts tracked in: facebookGroupPosts table
- Anti-spam: convex/antiSpam.ts
- Discovery: Every 4 hours (cron)
- Post generation: Daily 8am PT (cron)
- Outreach strategy: Every 6 hours (cron)

## Platform Sync Flow
1. External campaign URL registered
2. Convex syncs raised amount, donor count, goal amount
3. Balance displayed in platform dashboard
4. Funds can be migrated to holding accounts (fundMigration.ts)
5. Consolidation runs every 6 hours (fundConsolidation.ts)

## Fund Migration
- Migrate funds from external platforms to IF holding accounts
- Track gross (pre-fee) and net (post-fee) amounts
- Record in campaignLedger and financialAuditLog
- Dashboard: src/components/FundMigrationDashboard.tsx
- Implementation: convex/fundMigration.ts
