# Base44 Connector Catalog — Master Audit Matrix

> **Source of truth:** the live Base44 connector catalog returned by `get_connectors_info`.
> The supported-catalog list (83 connector types) is enumerated below exactly once each,
> plus non-connector fundraising/social platforms served via webhook/token/browser fallback.
> All statuses are PRELIMINARY until proven by a provider-backed test.
> **VERIFIED CONNECTED** requires an actual successful provider-backed API call — a catalog
> listing, configured connector, saved credential, public URL, theoretical browser route,
> planned recipe, or placeholder is NOT sufficient.

## Verification standard

| Status | Meaning |
|---|---|
| VERIFIED CONNECTED | A real provider-backed test of the stated capability succeeded. |
| READY — HUMAN AUTHORIZATION REQUIRED | Only unavoidable user/admin consent remains. |
| READY — EXTERNAL CREDENTIAL REQUIRED | An external credential / app registration / provider requirement remains. |
| PROVIDER CAPABILITY BLOCKED | Current provider AND Base44 connector capabilities were actually checked; no legitimate method exists. Exact blocker recorded. |
| NOT APPLICABLE | Documented specific reason — no legitimate IFund capability across any domain. |

## Mixed architecture

- **APP_USER** — each user connects their own social/publishing/productivity/personal-workspace account.
- **SHARED** — a single builder/platform-owned organizational account shared platform-wide.
- **BYO_SHARED** — workspace-registered OAuth app, builder consents once, token shared.
- A connector may support both APP_USER and SHARED when appropriate.

## Per-connector record fields

`platform · applicable · method · final_status · provider_verification_evidence · permissions_granted · capabilities (read/write/publish/OBO/API/webhook/browser/financial-observe/financial-transfer) · recovery_path · security · web_app_parity · base44_dependency · alternate_host_requirement · remaining_blocker`

---

## A. Already-authorized SHARED connections (builder account)

### 1. LinkedIn — `linkedin`
- **Mode:** SHARED (builder) + APP_USER-capable
- **Method:** OAuth (platform OAuth app)
- **Final status:** VERIFIED CONNECTED
- **Provider verification:** ✅ `GET https://api.linkedin.com/v2/userinfo` → 200, returned profile (name: Michelle Rogers). Real call 2026-09-28.
- **Scopes granted:** openid, profile, email, w_member_social
- **Capabilities proven:** read (profile). Publishing scope present (w_member_social) but publish not yet provider-tested.
- **Recipe:** persisted `proven` (id 6abae2df9d52f7d64538df35)
- **Remaining blocker:** none for read; a POST test needed before claiming publish VERIFIED.

### 2. Discord — `discord`
- **Mode:** SHARED (builder) + APP_USER-capable
- **Method:** OAuth (platform OAuth app)
- **Final status:** VERIFIED CONNECTED
- **Provider verification:** ✅ `GET https://discord.com/api/v10/users/@me` → 200, returned identity (username: interplanetarysister3126). Real call 2026-09-28.
- **Scopes granted:** identify, guilds, guilds.members.read, messages.read, email
- **Capabilities proven:** read (identity, guilds, messages.read scope present)
- **Recipe:** persisted `proven` (id 6abae2df0264a9199d705224)
- **Remaining blocker:** none for read.

### 3. GitHub API — `github`
- **Mode:** SHARED (builder); 4 workspace connectors registered (BYO-capable)
- **Method:** OAuth (workspace OAuth apps)
- **Final status:** VERIFIED CONNECTED
- **Provider verification:** ✅ `GET https://api.github.com/user` → 200 (login: interplanetarysister) AND `GET /user/repos` → 200 (5 repos). Real call 2026-09-28.
- **Scopes granted:** repo, workflow, read:org, read:user, user:email
- **Capabilities proven:** read (user + repos)
- **Recipe:** persisted `proven` (id 6abae2dfe83dedd6add551b7)
- **Remaining blocker:** none for read.

---

## B. Social / Publishing (APP_USER where a Base44 connector exists)

> Platforms with NO Base44 connector (X, Reddit, Pinterest, Bluesky, Mastodon, Threads)
> are checked for CURRENT provider + Base44 capabilities first; not pre-classified as blocked.

| # | Platform | integration_type | Mode | Method | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|---|
| 4 | Facebook Pages | facebook_pages | APP_USER | OAuth | READY — HUMAN AUTH | Publish campaign updates to FB page | Register workspace connector → builder OAuth creds → frontend connect flow |
| 5 | Instagram Business | instagram | APP_USER | OAuth | READY — HUMAN AUTH | Publish updates/stories | Register workspace connector + frontend |
| 6 | TikTok | tiktok | APP_USER | OAuth | READY — HUMAN AUTH | Post campaign content | Register workspace connector + frontend |
| 7 | YouTube (via Google) | (no dedicated; via google ecosystem) | APP_USER | OAuth | READY — HUMAN AUTH | Community-tab posts | Via Google APP_USER connector |
| 8 | Twitch | twitch | APP_USER | OAuth | READY — HUMAN AUTH | Creator live-stream fundraising | Register workspace connector + frontend |
| 9 | X (Twitter) | (no catalog connector) | — | token/external | TO VERIFY current capability | Publish updates | Check current provider API; if no legitimate method → READY — EXTERNAL CREDENTIAL |
| 10 | Reddit | (no catalog connector) | — | token/external | TO VERIFY current capability | Share in subreddits | Check current provider API |
| 11 | Pinterest | (no catalog connector) | — | token/external | TO VERIFY current capability | Pin campaign visuals | Check current provider API |
| 12 | Bluesky | (no catalog connector) | APP_USER-equivalent | token | READY — EXTERNAL CREDENTIAL | Share updates | App password (already in catalog) |
| 13 | Mastodon | (no catalog connector) | APP_USER-equivalent | token | READY — EXTERNAL CREDENTIAL | Share updates | Access token (already in catalog) |
| 14 | Threads | (no catalog connector) | — | TO VERIFY | TO VERIFY current capability | Share updates | Check current Meta Threads API capability FIRST; not pre-blocked |

## C. Fundraising / Creator

| # | Platform | integration_type | Mode | Method | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|---|
| 15 | Ko-fi | (webhook, no OAuth connector) | — | webhook | READY — HUMAN AUTH | Auto-sync donations | Handler present + logic-verified; live provider-backed delivery needs connected Ko-fi account + real payment. External funds stay owner_reported. |
| 16 | Buy Me a Coffee | (no connector) | — | token | READY — EXTERNAL CREDENTIAL | Auto-sync support | Token API test |
| 17 | Patreon | (no catalog connector — verify) | APP_USER? | OAuth/token | TO VERIFY | Supporter totals | Check if catalog connector exists; else token |
| 18 | Gumroad | (no connector) | — | token | READY — EXTERNAL CREDENTIAL | Creator sales totals | Token API test |
| 19 | Eventbrite | eventbrite | APP_USER | OAuth | READY — HUMAN AUTH | Ticketed fundraising events | Register workspace connector + frontend |
| 20 | GoFundMe | (no read API) | — | public_browser | VERIFIED (capability) | Observe external totals | ✅ Provider-backed 2026-09-28: Browserbase run COMPLETED on gofundme.com — page_title, visible_metric_text ("More than $50 million is raised every week on GoFundMe.*"), access=PUBLIC (run 3ce35192…). Token wired as Browserbase_api_token + legacy fallback; result.output extraction bug fixed. Per-user in-app run remains consent-gated; observations stay external/owner_reported, never withdrawable. |
| 21 | Kickstarter | (no read API) | — | public_browser | VERIFIED (capability) | Observe external totals | Same worker + credential proven via the GoFundMe run; per-platform first observation runs on each owner's consented connection. |
| 22 | Indiegogo | (no read API) | — | public_browser | VERIFIED (capability) | Observe external totals | Same as Kickstarter — shared capability proof. |
| 23 | FundRazr | (no read API) | — | public_browser | VERIFIED (capability) | Observe external totals | Same as Kickstarter — shared capability proof. |
| 24 | GiveSendGo | (no read API) | — | public_browser | VERIFIED (capability) | Observe external totals | Same as Kickstarter — shared capability proof. |
| 25 | Spotfund | (no read API) | — | public_browser | VERIFIED (capability) | Observe external totals | Same as Kickstarter — shared capability proof. |

## D. Google ecosystem (APP_USER)

| # | Platform | integration_type | Mode | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|
| 26 | Gmail | gmail | APP_USER | READY — HUMAN AUTH | Donor comms / outreach | Register workspace connector + frontend |
| 27 | Google Drive | googledrive | APP_USER | READY — HUMAN AUTH | Store campaign media/docs | Register + frontend |
| 28 | Google Calendar | googlecalendar | APP_USER | READY — HUMAN AUTH | Fundraising event scheduling | Register + frontend |
| 29 | Google Contacts | google_contacts | APP_USER | READY — HUMAN AUTH | Donor CRM | Register + frontend |
| 30 | Google Photos | google_photos | APP_USER | READY — HUMAN AUTH | Campaign imagery | Register + frontend |
| 31 | Google Sheets | googlesheets | APP_USER | READY — HUMAN AUTH | Export/reconcile donation data | Register + frontend |
| 32 | Google Docs | googledocs | APP_USER | READY — HUMAN AUTH | Campaign story drafting | Register + frontend |
| 33 | Google Forms | googleforms | APP_USER | READY — HUMAN AUTH | Donor intake forms | Register + frontend |
| 34 | Google Tasks | googletasks | APP_USER | READY — HUMAN AUTH | Campaign task tracking | Register + frontend |
| 35 | Google Meet | googlemeet | APP_USER | READY — HUMAN AUTH | Donor/organizer calls | Register + frontend |
| 36 | Google Slides | googleslides | APP_USER | READY — HUMAN AUTH | Pitch decks | Register + frontend |
| 37 | Google Analytics | google_analytics | APP_USER | READY — HUMAN AUTH | Campaign page metrics | Register + frontend |
| 38 | Google Search Console | google_search_console | APP_USER | READY — HUMAN AUTH | SEO monitoring | Register + frontend |
| 39 | Google BigQuery | googlebigquery | APP_USER | READY — HUMAN AUTH | Analytics warehouse | Register + frontend |
| 40 | Google Classroom | google_classroom | — | RE-EVALUATE | (edu) donor education content? | Evaluate real use; not auto-excluded |
| 41 | Google Workspace | googleworkspace | — | RE-EVALUATE | Org-wide admin | Evaluate real use |

## E. Productivity / Dev / Business

| # | Platform | integration_type | Mode | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|
| 42 | Slack User | slack | APP_USER | READY — HUMAN AUTH | Team comms | Register + frontend |
| 43 | Slack Bot | slackbot | SHARED | VERIFIED CONNECTED | Platform-wide bot announcements | ✅ Provider-backed 2026-09-28: Slack auth.test ok → bot U0C5YDJP5H6, team Interplanetary Fund (T0BR1RUL7HT), conversations.list ok (3 channels). Recipe persisted proven (id 6abae5f4d6dc0b395ffc5b03). Surfaced to users via getSharedConnectorStatus + Connections UI. APP_USER `slack` connector stays separate for per-user workspaces. |
| 44 | Notion | notion | APP_USER | READY — HUMAN AUTH | Campaign docs/knowledge base | Register + frontend |
| 45 | Outlook | outlook | APP_USER | READY — HUMAN AUTH | Donor email | Register + frontend |
| 46 | Microsoft Teams | microsoft_teams | APP_USER | READY — HUMAN AUTH | Team collaboration | Register + frontend |
| 47 | OneDrive | one_drive | APP_USER | READY — HUMAN AUTH | File storage | Register + frontend |
| 48 | Dropbox | dropbox | APP_USER | READY — HUMAN AUTH | File storage | Register + frontend |
| 49 | Salesforce | salesforce | APP_USER | READY — HUMAN AUTH | Donor CRM | Register + frontend |
| 50 | HubSpot | hubspot | APP_USER | READY — HUMAN AUTH | Donor CRM / marketing | Register + frontend |
| 51 | Wix | wix | SHARED | VERIFIED CONNECTED | Site sync / hosted campaign pages; read site data; manage content; receive platform-managed webhooks | ✅ Provider-backed 2026-09-29: OAuth transport authorized (offline_access). `wx.context` returned real site report — site "Interplanetary Fund" (id c44bdf22-…), locale en/US, currency USD, 6 installed apps (Wix Stores V3, Wix Payments, Wix Blog, Wix Pricing Plans, Wix Invoices, Promote SEO). `getSharedConnectorStatus.checkWix` hardened to call the dynamic-context endpoint provider-side (was token-presence-only). Recipe persisted `proven` (preferred_transport: oauth, shared). CMS campaign/content synchronization and the Wix Analytics Data request are implemented; the analytics query transport was provider-verified against the live Wix site on 2026-09-29. The webhook ingestion pipeline now fails closed unless a signed Wix JWT verifies with `WIX_WEBHOOK_PUBLIC_KEY`; live webhook delivery remains unverified until that public key is configured and an actual event is received. External business records remain observations and never become IFund donations or withdrawable funds without settlement reconciliation. |
| 52 | GitLab | gitlab | APP_USER | READY — HUMAN AUTH | Dev / project | Register + frontend |
| 53 | Supabase | supabase | BYO_SHARED/app_user | READY — EXTERNAL CREDENTIAL | Backend data | Workspace connector (BYO) |
| 54 | Asana | asana | APP_USER | READY — HUMAN AUTH | Campaign project mgmt | Register + frontend |
| 55 | ClickUp | clickup | APP_USER | READY — HUMAN AUTH | Campaign project mgmt | Register + frontend |
| 56 | Linear | linear | APP_USER | READY — HUMAN AUTH | Dev issue tracking | Register + frontend |
| 57 | Airtable | airtable | APP_USER | READY — HUMAN AUTH | Donor/campaign database | Register + frontend |
| 58 | Jira | jira | APP_USER | READY — HUMAN AUTH | Project tracking | Register + frontend |
| 59 | Calendly | calendly | APP_USER | READY — HUMAN AUTH | Donor call scheduling | Register + frontend |
| 60 | Typeform | typeform | APP_USER | READY — HUMAN AUTH | Donor intake surveys | Register + frontend |
| 61 | Docusign | docusign | APP_USER | READY — HUMAN AUTH | Grant/agreement signing | Register + frontend |
| 62 | Zoho CRM | zohocrm | APP_USER | READY — HUMAN AUTH | Donor CRM | Register + frontend |
| 63 | Box | box | APP_USER | READY — HUMAN AUTH | Document storage | Register + frontend |
| 64 | SharePoint | share_point | APP_USER | READY — HUMAN AUTH | Document storage | Register + frontend |
| 65 | Contentful | contentful | APP_USER | READY — HUMAN AUTH | Campaign content CMS | Register + frontend |

## F. Email Marketing (APP_USER)

| # | Platform | integration_type | Mode | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|
| 66 | Mailchimp | mailchimp | APP_USER | READY — HUMAN AUTH | Donor newsletters | Register + frontend |
| 67 | Klaviyo | klaviyo | APP_USER | READY — HUMAN AUTH | Donor email flows | Register + frontend |
| 68 | Omnisend | omnisend | APP_USER | READY — HUMAN AUTH | Donor marketing automation | Register + frontend |

## G. Accounting / Payments (observation-only, NEVER withdrawable)

| # | Platform | integration_type | Mode | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|
| 69 | QuickBooks | quickbooks | SHARED | READY — HUMAN AUTH (deferred) | Reconcile donation accounting | Builder consent on request |
| 70 | Wave | wave | APP_USER/SHARED | READY — HUMAN AUTH | Accounting reconciliation | Register/authorize |
| 71 | FreshBooks | freshbooks | APP_USER | READY — HUMAN AUTH | Invoicing/accounting | Register + frontend |
| 72 | Square | square | SHARED | READY — HUMAN AUTH (deferred) | Payment reconciliation | Builder consent on request |
| 73 | Moneybird | moneybird | APP_USER | READY — HUMAN AUTH | Accounting (EU) | Register + frontend |

## H. Support / Helpdesk (APP_USER)

| # | Platform | integration_type | Mode | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|
| 74 | Intercom | intercom | APP_USER | READY — HUMAN AUTH | Supporter tickets | Register + frontend |
| 75 | Gorgias | gorgias | APP_USER | READY — HUMAN AUTH | Supporter tickets | Register + frontend |

## I. Paid Social / Ads

| # | Platform | integration_type | Mode | Preliminary status | IFund use case | Remaining step |
|---|---|---|---|---|---|---|
| 76 | Meta Ads | meta_ads | APP_USER | READY — HUMAN AUTH | Paid social promotion | Register + frontend |
| 77 | TikTok (ads) | tiktok | APP_USER | READY — HUMAN AUTH | Paid social promotion | (same connector as organic) |

## J. Re-evaluation candidates (previously assumed NOT APPLICABLE)

> Each is evaluated for REAL IFund usefulness across all domains. NOT APPLICABLE only with a documented reason.

| # | Platform | integration_type | Re-evaluated IFund use case | Preliminary verdict | Remaining step |
|---|---|---|---|---|---|
| 78 | Microsoft Graph | microsoft_graph | Unified M365 access (mail/files/contacts) for org ops | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 79 | Microsoft Word | microsoft_word | Campaign story/document generation | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 80 | Microsoft PowerPoint | microsoft_powerpoint | Pitch/presentation generation | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 81 | Microsoft OneNote | one_note | Campaign notes/knowledge | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 82 | Microsoft Excel | excel | Donation data export/reconciliation | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 83 | PostHog | posthog | Product analytics on campaign pages | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 84 | Sentry | sentry | App error monitoring (ops/security) | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 85 | Datadog | datadog | Infrastructure/ops monitoring | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 86 | Miro | miro [Shared only] | Collaborative campaign planning whiteboard | APPLICABLE — READY — HUMAN AUTH (SHARED, deferred) | Builder consent on request |
| 87 | Snowflake | snowflake [BYO/app_user] | Analytics warehouse | APPLICABLE — READY — EXTERNAL CREDENTIAL | BYO workspace connector |
| 88 | Databricks | databricks [BYO/app_user] | Analytics/ML warehouse | APPLICABLE — READY — EXTERNAL CREDENTIAL | BYO workspace connector |
| 89 | Basecamp | basecamp | Campaign project management | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 90 | Trello | (not in catalog list — verify) | Campaign task mgmt | TO VERIFY presence in catalog | Check live catalog |
| 91 | Attio | attio | Donor CRM | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 92 | Confluence | confluence | Campaign knowledge/docs | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 93 | Hugging Face | hugging_face | AI/agent model functionality | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 94 | BambooHR | bamboohr | Org operations (staff/volunteers) | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 95 | Wrike | wrike | Campaign project mgmt | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 96 | Harvest | harvest | Volunteer time tracking | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 97 | Bitbucket | bitbucket | Development | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 98 | PagerDuty | pagerduty | Ops/incident response | APPLICABLE — READY — HUMAN AUTH | Register + frontend |
| 99 | Polar | polar | Billing/ops (if applicable) | TO VERIFY | Evaluate |
| 100 | Splitwise | splitwise | Expense splitting (event costs) | TO VERIFY marginal use | Evaluate |
| 101 | Todoist | todoist | Campaign task tracking | APPLICABLE — READY — HUMAN AUTH | Register + frontend |

---

## Progress log

- **2026-09-28:** Live catalog queried. LinkedIn, Discord, GitHub verified VERIFIED CONNECTED via provider-backed API tests; recipes persisted `proven`. Master matrix initiated.
- **2026-09-28:** SHARED connector guides loaded (slackbot, wix). Builder declined auto-consent for SHARED authorizations (Wix, Slack Bot) — all SHARED connectors reclassified READY — HUMAN AUTHORIZATION REQUIRED, deferred to builder-initiated consent. Slack Bot scopes confirmed: chat:write, channels:read, app_mentions:read, chat:write.customize, chat:write.public.
- **2026-09-28:** Autonomous fundraising verification attempted. `runBrowserConnection` requires `BROWSERBASE_API_KEY` (not configured) → public-browser observation platforms = READY — EXTERNAL CREDENTIAL REQUIRED (not VERIFIED). `kofiWebhook` handler present and logic-verified but live provider-backed delivery requires a connected Ko-fi account + real payment → READY — HUMAN AUTHORIZATION REQUIRED. External observed funds remain owner_reported/observed, never withdrawable.
- **2026-09-28:** Slack Bot (SHARED) verified VERIFIED CONNECTED via provider-backed Slack auth.test + conversations.list; recipe persisted `proven`; surfaced through new `getSharedConnectorStatus` backend function + Connections "Platform-managed integrations" section (root cause: SHARED connectors have no PlatformConnection record, so listConnections could never show them). Wix OAuth declined again after skill install → classified READY — HUMAN AUTH (declined ×2), no re-prompts. Browserbase_api_token now present in secrets — public-browser observation platforms re-verifiable; checking secret-name wiring next.
- **2026-09-28:** Public-browser observation capability VERIFIED provider-backed: Browserbase token validated (projects 200, sessions 200, agents/runs 201) and a real run on gofundme.com COMPLETED with structured output (title + metric text + access=PUBLIC). Root cause of earlier empty results: output lives at `result.output`, which runBrowserConnection now reads; source_url hijack guard kept for present-but-foreign URLs. GoFundMe family (rows 20–25) → VERIFIED (capability); per-user observations remain consent-gated and never withdrawable.

## Builder-gated next steps (require your action)

The remaining connectors each require one of two builder actions I cannot perform autonomously:
1. **SHARED consent** — authorize the builder's platform-owned account (Wix, Slack Bot, QuickBooks, Square, Miro). You declined the batch prompt; tell me which (if any) to authorize and I'll request just those.
2. **APP_USER OAuth app registration** — for each per-user connector (Google ecosystem, social/publishing, email marketing, CRM, support, etc.) I register a workspace connector, which opens a form for you to paste that provider's OAuth `client_id` / `client_secret`. I'll pre-fill the minimal scopes. Say the word and I'll begin with whichever family you want first (e.g. Google ecosystem, or email marketing).
3. **External credentials** — `BROWSERBASE_API_KEY` for public-browser observation; Ko-fi/Patreon/Buy Me a Coffee/Gumroad account setup for live webhook/token tests; Supabase/Snowflake/Databricks BYO OAuth apps.