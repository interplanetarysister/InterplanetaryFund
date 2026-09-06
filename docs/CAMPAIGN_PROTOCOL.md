# CAMPAIGN PROTOCOL — Interplanetary Fund
**Established:** 2026-08-01  
**Last Updated:** 2026-09-06  
**Authority:** Solene, Chief of Staff for Agents, Interplanetary Fund  
**Previous Authority:** Lyra (retired 2026-08-07)  
**Directive Source:** Michelle Rogers  
**Scope:** ALL campaigns — past, present, and future

---

## PROTOCOL STATEMENT

Every campaign in the Interplanetary Fund must comply with these standards from the moment of creation. There is no campaign that exists outside this protocol. This applies retroactively to existing campaigns, immediately to current campaigns, and automatically to all future campaigns.

---

## PROTOCOL STANDARDS

### P-1: OUTREACH PREFERENCE STANDARD
- New campaigns default to `outreach_enabled = true` unless an authorized creator explicitly chooses otherwise.
- An explicit `outreach_enabled = false` is a valid campaign opt-out and MUST be preserved by synchronization, migrations, protocol audits, auto-fix jobs, agents, and administrators unless the authorized campaign owner changes it.
- No background process may silently re-enable outreach after an opt-out.
- Subscriber outreach additionally requires an active qualifying subscription and the user's separate outreach permission; outreach controls MUST NOT grant, revoke, or infer paid subscription state.
- **Enforcement:** Canonical outreach dispatcher plus exact-head outreach invariant checks.

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
- **Enforcement:** Tracked in the Agent entity and updated by weekly training backend functions.

### P-7: EXTERNAL PLATFORM SYNC STANDARD
Any campaign that exists on an external crowdfunding platform SHOULD be connected to the Interplanetary Fund for live sync:
- External platform connection recorded (platform_name, campaign_url, sync_method)
- Raised amount, goal amount, and donor count synced from external platform
- Last sync timestamp tracked
- Sync status tracked (success, error, pending)
- Unified dashboard shows all connected accounts at once
- **Enforcement:** Platform Sync Agent monitors connections.

### P-8: FUND MIGRATION & HOLDING ACCOUNT STANDARD
Any funds migrated from external platforms into the Interplanetary Fund MUST be tracked through the holding-account and campaign-ledger systems:
- Available balance displayed as GROSS amount before withdrawal-time platform fees.
- Fee source and net recipient amount must be transparent before withdrawal.
- Platform and processor fees remain separate authorities and must follow the currently approved fee configuration.
- All payouts tracked with status (pending, processing, completed, failed).
- **Enforcement:** Treasury/financial-audit backend functions.

### P-9: OUTREACH SAFETY & EXTERNAL-PROOF STANDARD
All automated external outreach MUST:
- respect emergency stop, global agent controls, campaign opt-out, subscription/user permission gates where applicable, platform allowlists, quiet hours, retry limits, blocklists, cooldowns, and daily limits;
- avoid duplicate or near-duplicate Facebook group posts;
- reserve a Facebook destination atomically before browser submission so concurrent dispatches cannot target the same group;
- require durable external evidence (provider ID/permalink) before marking a post `posted`;
- hold ambiguous browser submissions in `verification_pending` instead of blindly retrying;
- use authenticated persistent Browserbase contexts for browser-only social accounts and fail closed if those contexts are unavailable;
- log dispatch decisions, failures, external evidence, subscription changes, and admin control changes.

---

## ENFORCEMENT MECHANISMS

### 1. Daily Protocol Enforcement
- Runs as a Convex backend job.
- Audits campaign data without overriding explicit outreach opt-outs.

### 2. Canonical Outreach Dispatcher
- Runs hourly.
- Applies all outreach gates before scheduling external work.
- Platform Outreach and Subscriber Outreach are independently controllable.

### 3. Subscription Authority
- Subscription activity is maintained by authorized billing/provider events or an explicit super-admin billing correction.
- Outreach toggles never create subscription entitlement.

### 4. Browserbase Social Publishing
- Facebook/Instagram browser publishing requires configured Browserbase credentials plus an authenticated persistent context.
- No authenticated context means no external post is claimed.

### 5. Exact-Head Validation
- Node 24 typecheck, production web build, admin-auth boundary checks, and outreach architecture invariants must pass on the exact pull-request head before merge.

---

## AMENDMENT PROCESS
This protocol may be amended by Michelle Rogers (Owner) or the current Chief of Staff with Michelle's approval. All amendments are logged with date and rationale.

### Amendment Log
- 2026-08-01: Added P-7 (External Platform Sync) and P-8 (Fund Migration & Holding Account).
- 2026-08-01: Updated enforcement to credit-free backend functions.
- 2026-08-07: Authority transferred from Lyra to Solene.
- 2026-09-06: Amended P-1 so explicit campaign outreach opt-outs are valid and cannot be silently reversed.
- 2026-09-06: Added P-9 canonical outreach safety, Browserbase external-proof, anti-spam, and subscription-authority requirements.
