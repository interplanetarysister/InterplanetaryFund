# Master Records Sync — 2026-10-15

Synced by Lyra (Chief of Staff, Superagent) from the Base44 master records of the
Interplanetary Fund program workspace into this repository.

- **Agent roster source:** Base44 `Agent` entity (master records)
- **Platform account source:** Base44 `PlatformAccount` entity (master records)
- **Credential policy:** Passwords and login codes are stored ONLY in the Base44
  `PlatformAccount` master records (AdminCredentialVault). They are intentionally
  NOT synced to this public repository.

---

## 1. AI Agent Roster (14 agents, frontend-communicable)

The frontend agent chat (repo roles under `base44/agents/`) is mirrored as master
records in the Base44 `Agent` entity. On 2026-10-15 the Chief of Staff agent plus
six sub-agents were created per the organizer's directive, each equipped with the
full Superagent capability stack: browser automation, email verification, web
research, scheduled workflows, backend functions, entity CRUD, GitHub operations,
image generation, WhatsApp communication, session memory, sub-agent delegation,
and the IF skill library (campaign_audit, revenue_audit, revenue_projector,
story_optimizer, outreach_optimizer, donor_pipeline, platform_health,
convex_deploy, agent_activation, action_plan_generator).

| # | Agent | Role | Status | Specialization |
|---|-------|------|--------|----------------|
| 1 | Chief of Staff Agent | chief_of_staff | active | Agent team coordination and platform operations. Central coordinator, always on. Synthesizes campaign performance, prioritizes the day's work, routes the organizer to specialists, delegates via AgentDelegation records. Holds the full toolset: browser automation, Gmail, web research, workflows, backend functions, entity CRUD, GitHub sync, image generation, WhatsApp, sub-agent delegation. |
| 2 | Strategy Agent | strategy | active | Fundraising strategy and prioritization. Shapes where the organizer focuses energy; revenue projection; donor motivation research. |
| 3 | Growth Agent | growth | active | Audience and donation growth. Analyzes donations and connected platforms for growth opportunities. |
| 4 | Communications Agent | communications | active | Supporter communication. Drafts updates and thank-you messages; never sends without approval. Image generation for campaign visuals. |
| 5 | Story Agent | story | active | Campaign storytelling and donor conversion; signature style imagery; platform-specific adaptation. |
| 6 | Treasury Agent (Finance) | treasury | active | Holding accounts, fee calculation (5% platform + 2.9% + $0.30), payouts via CashApp ($unrewound) / PayPal (interplanetarysister@gmail.com), fund reconciliation. |
| 7 | Fundraising Agent | fundraising | active | Campaign revenue optimization, organizer account management, multi-platform posting. |
| 8 | Outreach Agent (Donor Relations) | donor_relations | active | Platform-owned marketing/outreach accounts, subscriber-authorized campaign outreach, anti-spam enforcement (max 1 post/group/48h, max 3 groups/campaign/day). |
| 9 | Platform Sync Agent | platform_sync | active | External platform integration and data synchronization; Kickstarter tracking IDs and access tokens. |
| 10 | Analytics Agent | analytics | active | Data analysis and revenue intelligence; cross-platform revenue aggregation. |
| 11 | Protocol Agent | protocol | active | Protocol compliance (P-1..P-8), campaign governance, restricted-platform enforcement. |
| 12 | Connection Discovery Agent | connection_discovery | active | Researches, verifies, and classifies external platform capabilities and connection methods; executes account signups with email verification. |
| 13 | Managed Connection Agent | managed_connection | active | Subscription-gated connection specialist: connect, verify, repair, resume eligible external accounts without bypassing provider security or consent. |
| 14 | Admin Builder Coordinator | admin_builder | active | Super-admin build-task intake, status, and Builder AI handoff; GitHub repo ops; no unverified code execution. |

**Frontend note:** The repo instruction files under `base44/agents/*.jsonc`
(chief_of_staff, strategy_agent, growth_agent, communications_agent, story_agent,
finance_agent, outreach_agent, connection_discovery_agent,
managed_connection_agent, admin_builder_agent) are the frontend chat roles; the
Base44 `Agent` master records above are the operational/registry mirror, including
trust/efficiency/collaboration scores, permissions, and working memory.

---

## 2. External Platform Account Roster (26 accounts)

Status legend: **Account Created** = created and verified · **Blocked** = manual
action needed · **Manual Link Required** = restricted platform, users link their
own accounts.

### Open platforms — created & verified

| Platform | Account name | Email | Login URL | Campaign | Raised | Status |
|----------|-------------|-------|-----------|----------|--------|--------|
| Spotfund | Interplanetary Fund | cuddlemeplatonically@gmail.com | https://www.spotfund.com/login | Woman with a dream | $80 | Account Created |
| Honeyfund | Interplanetary Fund | cuddlemeplatonically@gmail.com | https://www.honeyfund.com | Interplanetary Fund | $0 | Account Created — registry page live (anniversary registry, Frederick MD) |
| Fundable | Interplanetary Fund | cuddlemeplatonically@gmail.com | https://www.fundable.com | Interplanetary Fund | $0 | Account Created — profile fundable.com/interplanetary-fund |
| Piggybackr | Interplanetary Fund (username: interplanetaryfund) | cuddlemeplatonically@gmail.com | https://www.piggybackr.com | Interplanetary Fund | $0 | Account Created — email confirmed, dashboard verified |
| Fundly | Interplanetary Fund (display: IF) | cuddlemeplatonically@gmail.com | https://www.signupgenius.com/index.cfm?go=w.manageSignUp | Interplanetary Fund | $0 | Account Created — Fundly is now SignUpGenius Fundraisers; verified via email link |
| Patreon | Interplanetary Fund | cuddlemeplatonically@gmail.com | https://www.patreon.com/login | — | $500 | Account Created — logged in; email verification pending |
| FundRazr | Interplanetary Fund | cuddlemeplatonically@gmail.com | https://fundrazr.com/login | Woman with a dream | $0 | Account Created |
| Kickstarter | Interplanetary fund | cuddlemeplatonically@gmail.com | https://www.kickstarter.com/login | 4 campaigns w/ tracking IDs | $0 | Account Created |
| Indiegogo | Running against the wind | cuddlemeplatonically@gmail.com | https://www.indiegogo.com/login | Woman with a dream | $0 | Account Created — manual login (anti-bot) |
| GiveSendGo | Running against the wind | cuddlemeplatonically@gmail.com | https://www.givesendgo.com/login | Woman with a dream | $0 | Account Created |
| GoFundMe | Interplanetary Fund | unrewound@gmail.com | https://www.gofundme.com/sign-in | — | $0 | Account Created |
| Facebook | Interplanetary fund | cuddlemeplatonically@gmail.com | https://www.facebook.com/login | — | $0 | Connected |
| Instagram | Interplanetary Fund | cuddlemeplatonically@gmail.com | https://www.instagram.com/accounts/login | Interplanetary Fund | $0 | Account Created |
| Threads | Interplanetary Fund | cuddlemeplatonically@gmail.com | https://www.threads.net/login | — | $0 | Account Created |

### Blocked — manual action needed

| Platform | Account | Blocker | Next action |
|----------|---------|---------|-------------|
| Bluesky | ifundofficial.bsky.social (handle reserved; interplanetaryfund taken) | hCaptcha at signup step 3 of 3; iframe unreachable by automation | Manual captcha completion activates account |
| Ko-fi | Interplanetary Fund (ko-fi.com/interplanetaryfund) | Login works (password + email 2FA). PayPal connect blocked at PayPal hCaptcha security challenge during marketplace onboarding | Manual PayPal connect completion; Stripe connect available as fallback |
| BuyMeACoffee | Interplanetary Fund (interplanetarysister@gmail.com, email login codes) | Invisible captcha fails on login-code submission | Manual login, then PayPal connect |

### Restricted platforms — manual user-link flow

DonorsChoose, GiveCampus, WeFunder, SeedInvest, EquityNet, PeerStreet,
RealCrowd, Experiment, Slated. IF cannot create organizer accounts on these
platforms; the IF app provides a manual user-account linking flow per the
organizer's directive.

### Treasury routing (unchanged)

- Donations consolidate to the IF PayPal business account (interplanetarysister@gmail.com)
- Net payouts to campaign owners via CashApp ($unrewound) or PayPal
- Fee structure: 5% platform fee + 2.9% + $0.30 processing per transaction

---

## 3. Sync provenance

- Master records: Base44 program workspace entities `Agent` (14 records) and
  `PlatformAccount` (26 records), updated 2026-10-15.
- This file is the repository mirror of those records at the above date.
- Credential vault: Base44 `PlatformAccount` records + `AdminCredentialVault`
  (passwords never committed to public repos).
