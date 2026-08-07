# Interplanetary Fund — Architecture

**Repo:** https://github.com/interplanetarysister/InterplanetaryFund
**Convex:** rosy-butterfly-2.convex.cloud
**Frontend:** https://interplanetarysister.github.io/InterplanetaryFund/
**Vercel:** TBD (pending setup)

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│              GitHub Repository                            │
│              interplanetarysister/InterplanetaryFund       │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────────┐   │
│  │ Convex  │  │ React    │  │ Capacitor (Mobile)     │   │
│  │ Backend │  │ Frontend │  │ android/ ios/          │   │
│  │ convex/ │  │ src/     │  │                        │   │
│  └────┬───┘  └────┬─────┘  └───────────┬────────────┘   │
│       │           │                     │                │
│       └───────────┴─────────────────────┘                │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────┐    ┌───────────────┐
│   Vercel     │    │  GitHub Pages  │
│  (Primary    │    │  (Fallback     │
│   Web Host)  │    │   Web Host)    │
│              │    │               │
│ Auto-deploy  │    │ Auto-deploy   │
│ from GitHub  │    │ from GitHub   │
│              │    │               │
│ VITE_CONVEX  │    │ VITE_CONVEX   │
│ _URL env var │    │ _URL baked in │
└──────┬───────┘    └──────┬───────┘
       │                   │
       └────────┬──────────┘
                ▼
┌──────────────────────────┐
│     Convex Cloud          │
│  rosy-butterfly-2         │
│  .convex.cloud            │
│                          │
│  25 Tables:              │
│  - agents (7)            │
│  - monitoredCampaigns(5) │
│  - protocolReports       │
│  - externalPlatforms     │
│  - holdingAccounts       │
│  - payoutRequests        │
│  - transactions          │
│  - donations             │
│  - supporterInteractions │
│  - feeConfig            │
│  - facebookConnections  │
│  - facebookGroups       │
│  - facebookGroupPosts   │
│  - accountsCreated      │
│  - spamBlocklist        │
│  - universalInbox       │
│  - distributedPosts     │
│  - userProfiles         │
│  - adminUsers           │
│  - adminSettings        │
│  - userCampaigns        │
│  - campaignUpdates      │
│  - followedCampaigns    │
│  - notifications         │
│                          │
│  Crons:                  │
│  - Daily 6am audit       │
│  - Weekly Sat 2am train  │
└──────────────────────────┘
```

## Data Flow

### Web App (Vercel — primary, GitHub Pages — fallback)
1. User opens the web app
2. React SPA loads from Vercel/Pages
3. React app connects to Convex via WebSocket
4. Real-time data sync (agents, campaigns, treasury, user data)
5. Mutations update Convex → triggers UI update

### Mobile App (APK from Base44)
1. User opens the Interplanetary Fund APK
2. Base44 app frontend loads
3. Base44 backend function calls Convex REST API
4. Data syncs: Convex → Base44 entities → APK UI
5. APK displays live campaign, agent, and treasury data

## Implementation Order

### Phase 1: Backend (Convex)
1. Schema tables ✅ (userProfiles, userCampaigns, campaignUpdates, followedCampaigns, notifications, donations)
2. Auth functions ✅ (register, login, getProfile)
3. Campaign CRUD ✅ (create, read, update, delete with ownership)
4. Donation recording ✅
5. Notifications ✅
6. Follow system ✅

### Phase 2: Frontend (React/Vite)
7. UserLogin ✅
8. UserDashboard ✅
9. CampaignEditor ✅
10. Campaign Detail Page ⬜ (public view + donation flow)
11. Explore page update ⬜ (switch to userCampaigns)
12. App.tsx routing ⬜ (wire user auth flow)

### Phase 3: Payments
13. Donation flow on campaign detail ⬜
14. Payout/withdrawal flow ⬜

### Phase 4: Growth Features
15. Communities, discussions, institutions, volunteers, AI, agent logging

## Protocol Enforcement (P-1 through P-8)

| Protocol | Rule | Enforcement | Status |
|----------|------|-------------|--------|
| P-1 | All campaigns must have outreach enabled | protocol.ts:enforceProtocol() | ✅ |
| P-2 | All campaigns must have AI profile complete | protocol.ts:enforceProtocol() | ✅ |
| P-3 | All campaigns must have a story present | protocol.ts:enforceProtocol() | ✅ |
| P-4 | All campaigns must have payment active | protocol.ts:enforceProtocol() | ✅ |
| P-5 | All campaigns must have required fields | protocol.ts:enforceProtocol() | ✅ |
| P-6 | Daily protocol audit at 6am | crons.ts | ✅ |
| P-7 | Gross-to-net fee calculation | treasury.ts:calculatePayout() | ✅ |
| P-8 | Batch payout processing | treasury.ts:calculateBatchPayout() | ✅ |

## Agent Architecture

All 7 agents stored as Convex records (not Base44 entities):
- Zero Base44 credit consumption for agent operations
- Full data portability
- Real-time WebSocket sync
- Cron-based automated training

| Agent | Role | Trust Score | Specialization |
|-------|------|-------------|----------------|
| Fundraising Agent | fundraising | 82 | Campaign optimization |
| Story Agent | story | 80 | Narrative crafting |
| Donor Relations Agent | donor_relations | 81 | Donor engagement |
| Protocol Agent | protocol | 90 | Compliance enforcement |
| Analytics Agent | analytics | 86 | Revenue projection |
| Treasury Agent | treasury | 88 | Fee & payout management |
| Platform Sync Agent | platform_sync | 84 | External integration |

## Security Model

- Convex: Ownership enforcement in mutation handlers (userId check)
- Admin: PIN-gated access (stored in feeConfig table)
- GitHub: Personal access token with workflow scope
- Vercel: Environment variable isolation
- No secrets in code — all in environment variables
