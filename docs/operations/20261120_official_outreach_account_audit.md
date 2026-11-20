# Official iFund outreach accounts — recovery and activation audit
Date: 2026-11-20 UTC. Canonical stack: interplanetarysister/InterplanetaryFund main, Cloudflare Pages + Supabase.

## Source coverage
The linked GitHub account exposes 17 repositories: InterplanetaryFund, interplanetary-fund2, interplanetaryfund1, paypal-ai-crowdfunder, PocketSpace, AmazonHackathon, PayPalHackathon, IBUHackathon, Open.aiHackathon, GITHUBHackathon, RingGuardian, OnlyCryptids, InterplanetaryBuilder, Dossier, FaceSwitch, pasted., ProofChain. Cross-repository code search for iFund/social/fundraising identities primarily identified the old account tracker at `interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx` and seed data at `interplanetarysister/interplanetaryfund1/convex/seed.ts`. The latter are **not current live provider grants**. Do not import seed statuses, campaign totals or “auto” settings as production truth.

The archived account tracker contains 19 rows, of which 15 are social or fundraising platform prospects. The remaining four are GitHub-adjacent infrastructure/payment service records (PayPal, Cash App, Convex and Vercel), not reusable social publishing OAuth accounts. GitHub appears separately among the 15 outreach identities because it can support public project discovery and documentation.

## What exists in production
- `ifund_connections`: no verified provider connections at this audit.
- `ifund_provider_tokens`: no saved provider grants at this audit.
- Connection-management and specialist Workers exist; `ifund-managed-connections-agent-preview`, `ifund-growth-agent-preview` and `ifund-communications-agent-preview` are configured, but communications outbound send is disabled. Provider binding presence does not establish social publishing permissions.
- 15 historic account/handle candidates are preserved in the **private** table `ifund_ops.official_outreach_account_candidates`. Legacy login emails are only visible via `ifund_admin_outreach_candidates()` to verified administrators. Browser users, anonymous users and agents cannot directly read the table.
- The administrator recovery board in `/admin/integrations` supports review stages and notes but deliberately has no “mark connected”, “grant publishing”, password entry or OAuth token import. Provider-backed member connection and explicit scope approval remain separate.

## Official promotion messaging
Use truthful, descriptive language for iFund, explaining AI-assisted campaign writing, campaign management, discovery and optional connected-platform sharing, without promising currently unavailable integrations, guaranteed donations, investor returns, verified partnerships, or live features not accepted as a real user.

**Priorities after existing-account access is reverified:**
1. **Bluesky:** legacy profile `interplanetaryfund.bsky.social`; use user-authored browser composition in the interim. A public link is not a publish credential.
2. **Facebook Page:** legacy profile `@InterplanetaryFund`; verify a current Page administrator and approved Meta Page posting scopes before any agent action.
3. **LinkedIn organization presence:** no reliable owned LinkedIn page was confirmed in current repo inventory; verify business identity, create an authorized page if necessary, and obtain posting access. Do not claim a page exists until its API identity is proven.

Fundraising-platform prospects: GoFundMe, Patreon, Ko-fi, Buy Me a Coffee, Spotfund, FundRazr, GiveSendGo, Indiegogo and Kickstarter. Their payment and fundraising requirements vary: never create a fundraiser or direct a donation to an unrelated merchant as a promotional shortcut.

**Agent responsibilities:** NEXUS verifies channel and policy, ECHO drafts platform-native educational posts, PULSE coordinates partner/funder introductions, LINK verifies destination URLs and account ownership. Drafting is available without external authority; any publication, account creation, direct message or financial enrollment requires the relevant provider's authenticated authorization and applicable user approval. Respect recipient opt-in and platform anti-spam policies; no bulk unsolicited campaigns.

## Acceptance
- Current owner/admin signs into each historical account and confirms current ownership, username, MFA and recovery email. Keep credentials in provider vaults, never code, notes, or agent prompts.
- Link the official account in iFund Connections through real provider consent. Verify `ifund_connections` and the encrypted token vault show a matching owner and required scopes.
- Test one approved informational post from the proper iFund business account. Confirm the actual provider post ID/URL, author identity and persistence, then verify revocation stops further posting.
- Do not treat a historical “active” label or an in-app prepared draft as a successful published post.
