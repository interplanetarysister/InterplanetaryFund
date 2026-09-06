# CAMPAIGN PROTOCOL — Interplanetary Fund
**Established:** 2026-08-01  
**Last Updated:** 2026-09-06  
**Authority:** Solene, Chief of Staff for Agents, Interplanetary Fund  
**Previous Authority:** Lyra (retired 2026-08-07)  
**Directive Source:** Michelle Rogers  
**Scope:** ALL campaigns — past, present, and future

---

## PROTOCOL STATEMENT

Every campaign in the Interplanetary Fund must comply with these standards from the moment of creation. This applies to existing, current, and future campaigns. Automation may repair missing or invalid operational data, but it must not override an explicit campaign/user outreach preference or other consent state.

---

## PROTOCOL STANDARDS

### P-1: OUTREACH PREFERENCE STANDARD
- Every campaign MUST have an explicit `outreachEnabled` boolean preference.
- New campaigns may default to `true` unless the creator explicitly selects otherwise.
- `false` is a valid opt-out and MUST be preserved by protocol enforcement, migrations, synchronization jobs, agents, and admin automation.
- A global outreach-agent toggle does not override a campaign-level opt-out.
- Subscriber outreach additionally requires an active qualifying subscription and user-level subscriber-outreach permission.
- **Enforcement:** Backend dispatch checks and CI invariants; daily auto-fix may not turn outreach back on.

### P-2: AI PROFILE STANDARD
Every campaign's AI profile SHOULD contain:
- `tone` — defined and non-empty
- `ideal_donors` — defined and non-empty
- `interested_orgs` — defined and non-empty
- `platforms` — at least one platform specified
- `priority` — defined
- **Enforcement:** Flagged in protocol audit; missing safe defaults may be filled automatically.

### P-3: STORY STANDARD
Every campaign MUST have:
- `story` — non-empty, optimized for clarity and accessibility
- `summary` — non-empty, concise description for SEO/meta
- **Enforcement:** Flagged in protocol audit.

### P-4: PAYMENT READINESS STANDARD
Every ACTIVE campaign MUST have a functional payment path.
- No active campaign may be represented as ready to accept donations without a usable payment path.
- **Enforcement:** Flagged in protocol audit.

### P-5: DATA COMPLETENESS STANDARD
Every campaign MUST have:
- `title` — non-empty
- `summary` — non-empty
- `story` — non-empty where required by campaign type
- `category` — defined
- `goalAmount` — greater than 0
- `coverImageUrl` — present where required
- `endDate` — defined for active campaigns where applicable
- `status` — defined
- **Enforcement:** Flagged in protocol audit; safe missing defaults may be filled automatically.

### P-6: AGENT ASSIGNMENT STANDARD
Every active campaign SHOULD be available to the appropriate campaign-management agents:
- Fundraising / outreach
- Story/content
- Donor relations
- Protocol/compliance
- Analytics
- Treasury where financial actions are authorized
- Platform synchronization where a platform connection exists

Agent assignment does not itself authorize an external side effect. External actions remain subject to the applicable user/campaign authorization and platform credentials.

### P-7: EXTERNAL PLATFORM SYNC STANDARD
Any campaign that exists on an external crowdfunding platform SHOULD be connected to Interplanetary Fund when the campaign owner has authorized that connection:
- platform/account connection recorded
- raised amount, goal amount, and donor count synchronized when supported
- last sync timestamp and health status tracked
- failures surfaced rather than silently treated as success
- campaign outreach preference preserved during synchronization

### P-8: FUND MIGRATION & HOLDING ACCOUNT STANDARD
Any funds migrated from external platforms into Interplanetary Fund MUST be tracked through the canonical financial system and audit trail. Financial calculations and current fee policy are controlled by the treasury/fee configuration and payment implementation; this protocol document does not override the current fee configuration.

---

## OUTREACH AGENT CONTROL STANDARD

Interplanetary Fund has two distinct outreach modes:

1. **Platform Outreach Agent** — controlled globally by admin. It may promote active, outreach-enabled campaigns, campaign activity/milestones, and Interplanetary Fund itself through authorized platform-owned channels.
2. **Subscriber Outreach Agent** — controlled separately by admin. It may perform additional outreach for a user's outreach-enabled campaign only when the backend verifies an active qualifying subscription and the user-level subscriber-outreach permission is enabled.

Shared requirements:
- global emergency stop
- platform allowlist
- quiet hours and dispatch limits
- anti-spam/cooldown enforcement
- backend authorization and OBO checks where applicable
- direct API preferred when available and reliable
- Browserbase persistent authenticated contexts for browser-only channels
- external permalink/ID or equivalent provider evidence before a post is marked `posted`
- ambiguous browser submissions enter verification state and are not blindly retried
- web and Capacitor app use the same Convex-backed controls

---

## ENFORCEMENT MECHANISMS

### 1. Daily Protocol Enforcement
- `convex/protocolAutoFix.ts`
- Repairs safe data issues but MUST preserve `outreachEnabled=false`.

### 2. Canonical Outreach Dispatcher
- `convex/outreachControl.ts`
- Scheduled hourly from `convex/crons.ts`.
- Re-checks global controls, emergency stop, quiet hours, campaign opt-out, subscription state, user permission, and platform eligibility at execution time.

### 3. Saturday Agent Training
- `convex/protocol.ts` weekly training and reporting.
- Outreach opt-out is not a protocol violation.

### 4. Treasury Management
- Canonical treasury/payment code and fee configuration govern financial operations.

### 5. CI Invariants
- `scripts/verify-outreach-invariants.mjs`
- Exact-head validation prevents reintroduction of outreach/subscription coupling, forced opt-in, false publish success, and missing Browserbase fail-closed behavior.

---

## AGENT ROSTER

The canonical agent roster is stored in Convex and may change over time. Agent state, permissions, automation toggles, memory, activity, and schedules must be read from the current backend rather than hard-coded historical counts in this document.

---

## AMENDMENT PROCESS
This protocol may be amended by Michelle Rogers (Owner) or by an authorized project agent acting within Michelle's approved project direction. Amendments must be recorded in source control with rationale.

### Amendment Log
- 2026-08-01: Added P-7 (External Platform Sync) and P-8 (Fund Migration & Holding Account).
- 2026-08-01: Updated recurring protocol work toward credit-free backend functions.
- 2026-08-07: Authority transferred from Lyra to Solene.
- 2026-09-06: Amended P-1. Outreach now defaults ON for new campaigns but explicit opt-out is valid and may not be overridden by protocol enforcement, synchronization, migration, or outreach agents. Added separate Platform Outreach and Subscriber Outreach control requirements.
