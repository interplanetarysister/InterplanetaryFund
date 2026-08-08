# Interplanetary Fund — Frontend Architecture Map
**Version:** 1.0.0
**Tech:** React 18 + TypeScript + Vite

## Pages (30+)

### Core User Flow
- Home.tsx — Landing page with stats, featured carousel, recent activity
- UserLogin.tsx — Login + registration combined (passwordless email auth)
- Dashboard.tsx — User dashboard with campaign stats
- Profile.tsx — User profile with stats, campaigns, donations

### Campaign System
- Campaigns.tsx — Campaign list management
- CampaignDetail.tsx — Single campaign view (timeline, social, press, top donors, confetti)
- CampaignEditor.tsx — Manual campaign editor
- AICampaignWizard.tsx — 6-step AI campaign generation wizard
- Explore.tsx — Public campaign discovery (sort, status, verified filters)
- Categories.tsx — Campaign categories
- Compare.tsx — Campaign comparison tool
- SavedCampaigns.tsx — Saved/bookmarked campaigns
- Leaderboard.tsx — Top campaigns leaderboard

### Financial
- Donations.tsx — Donation records
- Donors.tsx — Donor list with search + CSV export
- FinancialManagement.tsx — Treasury management with withdrawal

### Platform & Admin
- Admin.tsx — Multi-tab admin panel (overview, campaigns, agents, treasury, platforms, reports, permissions, control, activity, briefs)
- Platforms.tsx — External platform management
- PlatformDashboard.tsx — Platform sync dashboard
- FacebookGroups.tsx — Facebook group management (63 groups)
- Agents.tsx — Agent management and activity view
- Reports.tsx — Analytics with SVG charts
- Globe.tsx — 3D globe visualization (globe.gl)

### Community & Support
- Community.tsx — Community groups and discussions
- Help.tsx — Help center with support tickets
- InstitutionApply.tsx — Institution application form
- Notifications.tsx — User notifications
- Settings.tsx — User settings
- ThankYou.tsx — Post-donation thank you page
- ForgotPassword.tsx — Password reset request
- ResetPassword.tsx — Password reset form

## Components (26)
- CampaignCard.tsx — Campaign display card (dual field name support)
- CampaignCardSkeleton.tsx — Loading skeleton
- CompareButton.tsx — Campaign comparison trigger
- EmptyState.tsx — Empty state display
- ErrorBoundary.tsx — Error boundary wrapper
- FeaturedCarousel.tsx — Featured campaigns carousel
- FraudControl.tsx — Fraud control panel
- FundMigrationDashboard.tsx — Fund migration UI
- LazyImage.tsx — Intersection observer lazy loading
- LegalFooter.tsx — Legal footer
- MiniCharts.tsx — Mini bar charts for reports
- MissionBriefs.tsx — Agent mission briefs display
- PayPalDonateButton.tsx — PayPal donation button
- PermissionsManager.tsx — Admin permissions manager
- PlatformAccountsSheet.tsx — Platform accounts sheet
- RecentActivity.tsx — Recent activity feed
- RecommendationsSection.tsx — Recommendations section
- SaveButton.tsx — Campaign save/bookmark button
- ShareBar.tsx — Social share bar
- AgentActivity.tsx — Agent activity display

## Hooks (ported from fundforge)
- useComparison — Campaign comparison logic
- useCountUp — Number animation
- useDebounce — Debounce hook
- useSavedCampaigns — Saved campaigns state

## Mobile
- Capacitor 6 integration (Android + iOS)
- APK build via GitHub Actions
- Play Store configuration in play-store/
