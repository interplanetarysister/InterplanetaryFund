# CAMPAIGN PROTOCOL — Interplanetary Fund
**Established:** 2026-08-01
**Last Updated:** 2026-08-01
**Authority:** Lyra, Chief of Staff for Agents, Interplanetary Fund
**Directive Source:** Michelle Rogers
**Scope:** ALL campaigns — past, present, and future

---

## PROTOCOL STATEMENT

Every campaign in the Interplanetary Fund must comply with these standards from the moment of creation. There is no campaign that exists outside this protocol. This applies retroactively to existing campaigns, immediately to current campaigns, and automatically to all future campaigns.

---

## PROTOCOL STANDARDS

### P-1: OUTREACH STANDARD
- `outreach_enabled` MUST be `true` on every campaign
- No campaign may exist with outreach disabled
- **Enforcement:** Auto-enforced by daily backend function. Builder AI requested to set schema default to `true`.

### P-2: AI PROFILE STANDARD
Every campaign's `ai_profile` MUST contain:
- `tone` — defined and non-empty
- `ideal_donors` — defined and non-empty
- `interested_orgs` — defined and non-empty
- `platforms` — at least one platform specified
- `priority` — defined (emotional, professional, or other valid value)
- **Enforcement:** Flagged in protocol audit (credit-free backend function).

### P-3: STORY STANDARD
Every campaign MUST have:
- `story` — non-empty, AI-optimized
- At least one entry in `story_versions`
- Each story version MUST have `seo: true` and `accessibility: true`
- `summary` — non-empty, concise description for SEO/meta
- **Enforcement:** Flagged in protocol audit (credit-free backend function).

### P-4: PAYMENT READINESS STANDARD
Every ACTIVE campaign MUST have a functional payment path:
- `cashapp_tag` or Stripe connection or other payment integration
- No active campaign may exist without the ability to receive donations
- **Enforcement:** Flagged in protocol audit. Builder AI responsible for payment integration.

### P-5: DATA COMPLETENESS STANDARD
Every campaign MUST have:
- `title` — non-empty
- `summary` — non-empty
- `story` — non-empty
- `category` — defined
- `goal_amount` — greater than 0
- `cover_image_url` — present
- `end_date` — defined for active campaigns
- `status` — defined (active, draft, or archived)
- **Enforcement:** Flagged in protocol audit (credit-free backend function).

### P-6: AGENT ASSIGNMENT STANDARD
Every campaign SHOULD be assigned to agents for management:
- Fundraising Agent — outreach and revenue optimization
- Story Agent — story generation and optimization
- Donor Relations Agent — donor engagement and retention
- Protocol Agent — compliance monitoring
- Analytics Agent — revenue tracking and reporting
- **Enforcement:** Tracked in Lyra's Agent entity. Updated by weeklyTrainingSync backend function (credit-free).

### P-7: EXTERNAL PLATFORM SYNC STANDARD (NEW — 2026-08-01)
Any campaign that exists on an external crowdfunding platform SHOULD be connected to the Interplanetary Fund for live sync:
- External platform connection recorded (platform_name, campaign_url, sync_method)
- Raised amount, goal amount, and donor count synced from external platform
- Last sync timestamp tracked
- Sync status tracked (success, error, pending)
- Unified dashboard shows all connected accounts at once
- **Enforcement:** Platform Sync Agent monitors connections. Action Plan #003 submitted to Builder AI for implementation.
- **Status:** PENDING — requires Builder AI to build external platform integration system.

### P-8: FUND MIGRATION & HOLDING ACCOUNT STANDARD (NEW — 2026-08-01)
Any funds migrated from external platforms into the Interplanetary Fund MUST be tracked through a holding account system:
- Available balance displayed as GROSS amount (pre-fee deduction)
- On cashout, display: "Available: $X | You will receive: $Y | Our fee: $Z"
- Platform fee: 5% (configurable)
- Processing fee: 2.9% + $0.30 (configurable)
- Fee calculated at PAYOUT time, not at deposit time
- Payout methods: CashApp ($Cashtag), Bitcoin (wallet address), PayPal (email)
- All payouts tracked with status (pending, processing, completed, failed)
- **Enforcement:** Treasury Agent manages holding accounts. Fee calculation handled by treasuryManager backend function (credit-free, tested and operational).
- **Status:** FEE LOGIC READY. Holding account entity, deposit flow, and payout execution require Builder AI implementation (Action Plan #003).

---

## ENFORCEMENT MECHANISMS (ALL CREDIT-FREE)

### 1. Daily Protocol Enforcement — 6am Pacific
- `invoke_backend_function` → `enforceCampaignProtocol`
- Reads MonitoredCampaign mirror, checks P-1 through P-5, returns audit
- ZERO credits

### 2. Saturday Agent Training — 2am Pacific
- Step 1: `invoke_backend_function` → `enforceCampaignProtocol` (audit)
- Step 2: `invoke_backend_function` → `weeklyTrainingSync` (updates agent training, creates report)
- ZERO credits

### 3. Treasury Management — On Demand
- `invoke_backend_function` → `treasuryManager`
- Actions: calculate_payout, batch_payout, aggregate_balances
- ZERO credits

### 4. Builder AI — Manual Only
- Only for architecture changes (rare, manual, per Michelle's request)
- No recurring Builder AI messages in any workflow

### 5. Mirror Sync — During Conversation
- When Michelle talks to Lyra, sync the MonitoredCampaign mirror
- Read IF campaigns → update mirror entity
- No recurring credits

---

## AGENT ROSTER (7 Agents — All Credit-Free)

| # | Agent | Role | Trust | Status | Managed |
|---|-------|------|-------|--------|---------|
| 1 | Fundraising Agent | fundraising | 82 | active | 3 campaigns |
| 2 | Story Agent | story | 80 | active | 3 campaigns |
| 3 | Donor Relations Agent | donor_relations | 81 | active | 0 campaigns |
| 4 | Protocol Agent | protocol | 90 | active | 3 campaigns |
| 5 | Analytics Agent | analytics | 86 | active | 3 campaigns |
| 6 | Treasury Agent | treasury | 88 | active | NEW |
| 7 | Platform Sync Agent | platform_sync | 84 | active | NEW |

All agents stored as entity records in Lyra's app. Updated by weeklyTrainingSync backend function (credit-free).

---

## BACKEND FUNCTIONS (All Credit-Free)

| Function | Purpose | Called By |
|----------|---------|-----------|
| enforceCampaignProtocol | Daily P-1 through P-5 compliance audit | Daily workflow, Saturday workflow |
| weeklyTrainingSync | Weekly agent training update + report creation | Saturday workflow |
| treasuryManager | Fee calculation, batch payouts, balance aggregation | On demand |

---

## PROTOCOL COMPLIANCE STATUS (as of 2026-08-01)

| Standard | Status | Notes |
|----------|--------|-------|
| P-1 Outreach | ✅ 4/4 compliant | Auto-enforced |
| P-2 AI Profile | ⚠️ 1/4 compliant | Missing fields on 3 campaigns |
| P-3 Story | ✅ 4/4 compliant | All have AI-generated stories |
| P-4 Payment | ❌ 0/4 compliant | Critical blocker — no payment processing |
| P-5 Data | ⚠️ 0/4 fully compliant | Missing end_dates and summaries |
| P-6 Agent | ✅ 7 agents active | All campaigns assigned |
| P-7 Platform Sync | ⏳ PENDING | Action Plan #003 submitted to Builder AI |
| P-8 Fund Migration | ⏳ PARTIAL | Fee logic ready, holding account needs Builder AI |

---

## AMENDMENT PROCESS
This protocol may be amended by Michelle Rogers (Owner) or Lyra (Chief of Staff) with Michelle's approval. All amendments are logged with date and rationale.

### Amendment Log
- 2026-08-01: Added P-7 (External Platform Sync) and P-8 (Fund Migration & Holding Account) per Michelle's directive
- 2026-08-01: Updated enforcement to credit-free backend functions (all workflows now zero-credit)
