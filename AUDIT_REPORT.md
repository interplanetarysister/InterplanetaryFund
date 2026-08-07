# Fundforge Architecture Audit — 2026-08-07

## Original Fundforge Architecture (153 files)

### Entities (10) → Convex Tables (40)
| Fundforge Entity | Convex Table | Status |
|-----------------|-------------|--------|
| Campaign | userCampaigns + monitoredCampaigns | ✅ |
| CampaignUpdate | campaignUpdates | ✅ |
| Comment | comments | ✅ |
| Donation | donations | ✅ |
| Follow | followedCampaigns | ✅ |
| HelpArticle | helpArticles | ✅ |
| Notification | notifications | ✅ |
| SavedCampaign | savedCampaigns | ✅ |
| SupportTicket | supportTickets | ✅ |
| User | userProfiles | ✅ |

**Verdict: All 10 entities have Convex equivalents. Backend data model is COMPLETE.**

### Backend Functions (7) → Convex Functions
| Fundforge Function | Convex Equivalent | Status |
|-------------------|-----------------|--------|
| chat-assistant | ❌ Missing | NEEDS IMPLEMENTATION |
| create-checkout | paypalCheckout.ts | ✅ |
| getRecommendations | userCampaigns.ts | ✅ |
| manageFollow | savedCampaigns.ts | ✅ |
| send-donor-thankyou | emailSystem.ts | ✅ |
| sendCampaignEmail | emailSystem.ts | ✅ |
| wix-payments-webhook | paypalWebhook.ts | ✅ |

**Verdict: 6/7 backend functions implemented. Missing: chat-assistant.**

### Pages (21) → Current Pages
| Fundforge Page | Current Equivalent | Status |
|---------------|-------------------|--------|
| Home | Home.tsx | ✅ |
| Discover | Explore.tsx | ✅ |
| CreateCampaign | CampaignEditor.tsx | ✅ |
| CampaignDetail | CampaignDetail.tsx | ✅ |
| ThankYou | ThankYou.tsx | ✅ |
| Admin | Admin.tsx | ✅ |
| Help | Help.tsx | ✅ |
| Login | UserLogin.tsx | ✅ |
| Donations | ❌ | MISSING |
| Donors | ❌ | MISSING |
| Categories | ❌ | MISSING |
| Compare | ❌ | MISSING |
| Leaderboard | ❌ | MISSING |
| Saved | ❌ | MISSING (backend exists) |
| Profile | ❌ (partial in UserDashboard) | MISSING |
| Settings | ❌ | MISSING |
| Notifications | ❌ (partial in UserDashboard) | MISSING |
| Register | ❌ (may be in UserLogin) | NEEDS VERIFICATION |
| ForgotPassword | ❌ | MISSING |
| ResetPassword | ❌ | MISSING |
| Analytics | Reports.tsx? | NEEDS VERIFICATION |

### Additional Pages in Current Version (not in Fundforge)
- AICampaignWizard, Agents, Campaigns, Community, Dashboard, FacebookGroups, Globe,
  InstitutionApply, PlatformDashboard, Platforms, Treasury, UserDashboard, Volunteer

### Components Missing
- ChatWidget, DonationModal, FeaturedCarousel, Timeline, SuccessStories
- TrustBadge, CompareButton, RecommendationsSection, RecentActivity
- WhatsNewModal, CampaignForm, CampaignCard, CampaignCardSkeleton

## Priority Implementation Order

### Phase 1: User-Facing Pages with Backend Support
1. Saved Campaigns page (savedCampaigns.ts exists)
2. Donations page (getDonations exists)
3. Profile page (getProfile exists)
4. Notifications page (getNotifications exists)

### Phase 2: Discovery Pages
5. Categories page
6. Leaderboard page
7. Donors page
8. Compare page

### Phase 3: Auth & Settings
9. Register (verify if in UserLogin)
10. ForgotPassword
11. ResetPassword
12. Settings

### Phase 4: Components
13. ChatWidget
14. DonationModal
15. FeaturedCarousel
16. Timeline, SuccessStories, etc.

## Frontend-Backend Sync Verification
- Need to verify every Convex query/mutation has a frontend caller
- Need to verify every frontend page calls the correct Convex API
- Need to ensure real-time WebSocket sync is working
