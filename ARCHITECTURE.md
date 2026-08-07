# Interplanetary Fund — Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
│              interplanetarysister/                        │
│           interplanetary-fund-backend                     │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────────┐   │
│  │ Convex  │  │ React    │  │ Capacitor (Mobile)     │   │
│  │ Backend │  │ Frontend │  │ android/ ios/          │   │
│  │ convex/ │  │ src/     │  │                        │   │
│  └────┬───┘  └────┬─────┘  └───────────┬────────────┘   │
│       │           │                     │                │
│       └───────────┴─────────────────────┘                │
│                   │                                      │
│          Copilot Instructions                           │
│          .github/copilot-instructions.md                 │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────┐    ┌───────────────┐
│   Vercel     │    │   Base44      │
│  (Web Host)  │    │  (APK Build)  │
│              │    │               │
│ Auto-deploy  │    │ Syncs from    │
│ from GitHub  │    │ Convex API    │
│              │    │               │
│ VITE_CONVEX  │    │ Backend fn    │
│ _URL env var │    │ syncs data    │
└──────┬───────┘    └──────┬───────┘
       │                   │
       └────────┬──────────┘
                ▼
┌──────────────────────────┐
│     Convex Cloud          │
│  rosy-butterfly-2         │
│  .convex.cloud            │
│                          │
│  8 Tables:               │
│  - agents (7)            │
│  - monitoredCampaigns(4) │
│  - protocolReports       │
│  - externalPlatforms     │
│  - holdingAccounts       │
│  - payoutRequests        │
│  - transactions          │
│  - feeConfig             │
│                          │
│  Crons:                  │
│  - Daily 6am audit       │
│  - Weekly Sat 2am train  │
└──────────────────────────┘
```

## Data Flow

### Web App (Vercel)
1. User opens `https://interplanetary-fund.vercel.app`
2. Vercel serves the React SPA from `dist/`
3. React app connects to Convex via WebSocket
4. Real-time data sync (agents, campaigns, treasury)
5. Mutations update Convex → triggers UI update

### Mobile App (APK from Base44)
1. User opens the Interplanetary Fund APK
2. Base44 app frontend loads
3. Base44 backend function calls Convex REST API
4. Data syncs: Convex → Base44 entities → APK UI
5. APK displays live campaign, agent, and treasury data

### GitHub Copilot
1. `.github/copilot-instructions.md` provides context
2. Copilot understands the full architecture
3. Can suggest changes to Convex functions, React components, or mobile config
4. Changes are committed and pushed → auto-deploy to Vercel

## Protocol Enforcement (P-1 through P-8)

| Protocol | Rule | Enforcement |
|----------|------|-------------|
| P-1 | All campaigns must have outreach enabled | `protocol.ts:enforceProtocol()` |
| P-2 | All campaigns must have payment active | `protocol.ts:enforceProtocol()` |
| P-3 | All campaigns must have a story present | `protocol.ts:enforceProtocol()` |
| P-4 | All campaigns must have a cover image | `protocol.ts:enforceProtocol()` |
| P-5 | All campaigns must have a target audience | `protocol.ts:enforceProtocol()` |
| P-6 | Daily protocol audit at 6am | `crons.ts` |
| P-7 | Gross-to-net fee calculation | `treasury.ts:calculatePayout()` |
| P-8 | Batch payout processing | `treasury.ts:calculateBatchPayout()` |

## Agent Architecture

All 7 agents are stored as Convex records (not Base44 entities). This ensures:
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

- Convex: Row-level security via auth tokens (future)
- Base44: Row-level security on sync entities
- GitHub: Private repo with OAuth token access
- Vercel: Environment variable isolation
- No secrets in code — all in environment variables
