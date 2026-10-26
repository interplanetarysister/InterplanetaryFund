# Original IFund → independent app route parity matrix
Source: [read-only source App.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/App.jsx) inspected 2026-10-26.
Target: [integration branch App.jsx](https://github.com/interplanetarysister/InterplanetaryFund/blob/migration/supabase-cloudflare/src/App.jsx) inspected 2026-10-26.
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).

**Acceptance rule:** A route is not migrated because a link exists, a static page compiles or a database table exists. It needs source-equivalent composition, independent auth/data writes, mobile/theme QA, and regression proof. Pending features are non-interactive in the recovery sidebar, rather than navigating to a fake replacement. This document does not authorize production deployment.

Source declares 58 named routes (excluding fallback), backed by 56 lazy-loaded page imports; this includes one source redirect and one inline mail route. The independent scaffold implements only a subset. "Partial" means no acceptance proof, not functional equivalence.

| Source URL | Source component | Access | Independent implementation |
| --- | --- | --- | --- |
| `/login` | Login | Public | Partial scaffold; backend/data parity unverified |
| `/register` | Register | Public | Not ported / not released |
| `/forgot-password` | ForgotPassword | Public | Not ported / not released |
| `/reset-password` | ResetPassword | Public | Not ported / not released |
| `/globe` | GlobalGlobe | Public | Not ported / not released |
| `/embed/campaign/:id` | EmbedCampaign | Public | Not ported / not released |
| `/oauth/consent` | OAuthConsent | Public | Not ported / not released |
| `/activate` | DeviceActivation | Public | Not ported / not released |
| `/` | Home | Public | Partial scaffold; backend/data parity unverified |
| `/about` | About | Public | Not ported / not released |
| `/founding-members` | FoundingMembers | Public | Not ported / not released |
| `/terms` | Terms | Public | Not ported / not released |
| `/privacy` | Privacy | Public | Not ported / not released |
| `/contact` | Contact | Public | Not ported / not released |
| `/admin/organization-mail` | main | Admin | Not ported / not released |
| `/discover` | Discover | Public | Partial scaffold; backend/data parity unverified |
| `/campaign/:id` | CampaignDetail | Public | Partial scaffold; backend/data parity unverified |
| `/community` | Community | Public | Partial scaffold; backend/data parity unverified |
| `/community/:id` | CommunityDetail | Public | Not ported / not released |
| `/u/:id` | PublicProfile | Public | Not ported / not released |
| `/social` | Social | Public | Not ported / not released |
| `/blogs` | Blogs | Public | Not ported / not released |
| `/blogs/:id` | BlogArticle | Public | Not ported / not released |
| `/publications/:id` | PublicationArticle | Public | Not ported / not released |
| `/help` | Help | Public | Not ported / not released |
| `/help/:slug` | HelpArticle | Public | Not ported / not released |
| `/onboarding` | Onboarding | Member | Not ported / not released |
| `/dashboard` | Dashboard | Member | Not ported / not released |
| `/create` | CreateCampaign | Member | Partial scaffold; backend/data parity unverified |
| `/giving` | MyGiving | Member | Not ported / not released |
| `/communications` | Communications | Member | Not ported / not released |
| `/mission` | MissionControlPage | Member | Not ported / not released |
| `/ai-images` | AIImageStudio | Member | Not ported / not released |
| `/institutions` | Institutions | Member | Not ported / not released |
| `/institutions/:id` | InstitutionDetail | Member | Not ported / not released |
| `/profile` | Profile | Member | Not ported / not released |
| `/my-blog` | MyBlog | Member | Not ported / not released |
| `/devices` | ConnectedDevices | Member | Not ported / not released |
| `/connections` | Connections | Member | Partial scaffold; backend/data parity unverified |
| `/inbox` | Inbox | Member | Not ported / not released |
| `/following` | FollowedCampaigns | Member | Not ported / not released |
| `/notifications` | Notifications | Member | Not ported / not released |
| `/donors` | Donors | Member | Not ported / not released |
| `/ledger` | FinancialLedger | Member | Not ported / not released |
| `/subscriptions` | Subscriptions | Member | Not ported / not released |
| `/withdrawals` | Withdrawals | Member | Not ported / not released |
| `/agents` | Agents | Member | Not ported / not released |
| `/ops` | OpsCenter | Admin | Not ported / not released |
| `/platform` | Platform | Admin | Not ported / not released |
| `/analytics` | Analytics | Admin | Not ported / not released |
| `/connect` | redirect | Admin | Not ported / not released |
| `/admin/external-accounts` | ExternalAccounts | Admin | Not ported / not released |
| `/admin/integrations` | IntegrationsAdmin | Admin | Not ported / not released |
| `/admin/audit` | AuditLogAdmin | Admin | Not ported / not released |
| `/admin/agent-api` | AdminAgentApi | Admin | Not ported / not released |
| `/admin/sustainability` | SustainabilityAdmin | Admin | Not ported / not released |
| `/admin/help` | HelpAdmin | Admin | Not ported / not released |
| `/admin/founding-members` | AdminFoundingWaitlist | Admin | Not ported / not released |

## Shared navigation and visual parity

- Source `src/components/Layout.jsx` groups public Explore and member Explore, Campaigns & Giving, Community, AI Tools, Account & Help, and Administration.
- New non-production `MigrationShell.jsx` restores this sidebar hierarchy, mobile drawer, bottom navigation, current-page bar and saved light/dark theme. Links for missing features are explicitly marked Pending; they must remain unavailable until their server policy and product behavior are implemented.
- The deployed scaffold's Planet SVG is an approximation, **not** an exact copy of the original brand image, which is currently referenced from a Base44 media URL. Obtain and store the rights-cleared image on independent storage before visual acceptance.
- Source layout's responsive cards, accessibility, typography, component-level theme styling, media workflow, full feed, and animations need screenshot/video comparisons. User navigation recordings have not been available for this verification; do not claim visual acceptance.

## Behavior gates, independent of routing

| Gate | Evidence required |
| --- | --- |
| Accounts and access | User sign-in and recovery, old user mapping with consent, server-checked admin access, cross-account RLS tests |
| Campaign & social | Save/reopen draft, publish, edit, upload, community, stories, comments, verified ownership, status visibility |
| AI team | Single user-facing Chief of Staff conversation with specialist dispatch, status and continuity; preserve independent specialist agents |
| Finance | PayPal merchant/webhook identity, platform and campaign receipt reconciliation, idempotent ledger, held funds, approved Payouts, sandbox tests |
| Migration data | Original users/posts/campaigns/files/media, provenance and row-by-row reconciled counts; never publicly surface private staging rows |
| Production | Final HTML/CSS screenshot comparisons on mobile and desktop, independent Worker APIs (no Base44-origin proxy), DNS/mail rollback plan |

## Release gate

Do not point Cloudflare Pages production to this recovery branch, merge it to `main`, enable live payments, change DNS, or claim cutover until owner-reviewed acceptance gates above pass. Source `interplanetary-fund2` is read-only.
