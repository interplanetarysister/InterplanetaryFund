# Original IFund parity acceptance matrix (release-blocking)

Source: [read-only original `src/App.jsx`](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/App.jsx); repository reference at current source content SHA `2c7926c47f5469c834d5d0f044181bd7255d8b84`. Destination: [draft PR #156](https://github.com/interplanetarysister/InterplanetaryFund/pull/156). Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).

**Original maximum observed defined routes: 58** (25 ordinary visitor/public URLs; 21 member URLs; 11 admin URLs; 1 separately protected organizational-mail URL). There are 57 source page JSX modules, but `/connect` is a redirect and organizational mail is routed through an independent component. **This count is a source inventory, not verified historical production availability.**

The existing migration currently mounts all 58 original patterns. This is not functional parity: 10 mounted independent UI patterns, 11 with narrow independent functionality, and 37 limited source-context screens. All routes still have `release_status: not_verified` until actual end-to-end evidence is recorded. No screen should be recorded as complete just because it renders or compiles.

| Source route | Reference component | Allowed roles | Current stage | Release |
| --- | --- | --- | --- | --- |
| \`/login\` | \`Login\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/register\` | \`Register\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/forgot-password\` | \`ForgotPassword\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/reset-password\` | \`ResetPassword\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/globe\` | \`GlobalGlobe\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/embed/campaign/:id\` | \`EmbedCampaign\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/oauth/consent\` | \`OAuthConsent\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/activate\` | \`DeviceActivation\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/\` | \`Home\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/about\` | \`About\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/founding-members\` | \`FoundingMembers\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/terms\` | \`Terms\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/privacy\` | \`Privacy\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/contact\` | \`Contact\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/organization-mail\` | \`IndependentAdminMail\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/discover\` | \`Discover\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/campaign/:id\` | \`CampaignDetail\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/community\` | \`Community\` | visitor, member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/community/:id\` | \`CommunityDetail\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/u/:id\` | \`PublicProfile\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/social\` | \`Social\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/blogs\` | \`Blogs\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/blogs/:id\` | \`BlogArticle\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/publications/:id\` | \`PublicationArticle\` | visitor, member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/help\` | \`Help\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/help/:slug\` | \`HelpArticle\` | visitor, member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/onboarding\` | \`Onboarding\` | member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/dashboard\` | \`Dashboard\` | member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/create\` | \`CreateCampaign\` | member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/giving\` | \`MyGiving\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/communications\` | \`Communications\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/mission\` | \`MissionControlPage\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/ai-images\` | \`AIImageStudio\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/institutions\` | \`Institutions\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/institutions/:id\` | \`InstitutionDetail\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/profile\` | \`Profile\` | member, admin, super_admin | UI_partial | **NOT VERIFIED** |
| \`/my-blog\` | \`MyBlog\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/devices\` | \`ConnectedDevices\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/connections\` | \`Connections\` | member, admin, super_admin | mounted | **NOT VERIFIED** |
| \`/inbox\` | \`Inbox\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/following\` | \`FollowedCampaigns\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/notifications\` | \`Notifications\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/donors\` | \`Donors\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/ledger\` | \`FinancialLedger\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/subscriptions\` | \`Subscriptions\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/withdrawals\` | \`Withdrawals\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/agents\` | \`Agents\` | member, admin, super_admin | limited | **NOT VERIFIED** |
| \`/ops\` | \`OpsCenter\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/platform\` | \`Platform\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/analytics\` | \`Analytics\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/connect\` | \`Navigate\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/external-accounts\` | \`ExternalAccounts\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/integrations\` | \`IntegrationsAdmin\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/audit\` | \`AuditLogAdmin\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/agent-api\` | \`AdminAgentApi\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/sustainability\` | \`SustainabilityAdmin\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/help\` | \`HelpAdmin\` | admin, super_admin | limited | **NOT VERIFIED** |
| \`/admin/founding-members\` | \`AdminFoundingWaitlist\` | admin, super_admin | limited | **NOT VERIFIED** |

## Required proof per page

- Actual HTML/interaction with live independent **role-appropriate auth and data**, not mock fixtures or a fallback Base44 proxy.
- Screenshot comparison to original owner-approved reference on desktop 1440px, tablet 768px, mobile 390px in **both dark and light themes**, and Android installed app in both themes. Include source/ref, dates and meaningful visual-diff review.
- Visitor, member, admin and super-admin access tests (both permitted and denied). For organizational mail, enforce independent server-side authorization; do not rely on the public router branch.
- Primary controls, secondary actions, forms, error/empty/loading cases, navigation/deep links, keyboard use and persistence tested on web and Android. Link to test run, backend logs/receipt or screenshot proof for each.
- Prior original failures must be *fixed*, not faithfully reproduced. Finance, agent automation, social OBO, private inbox/notifications, account recovery and media all need verified backend proofs.
- Once evidence is collected, set each route `release_status` to `verified`, populate the proof fields in `docs/migration/role-platform-evidence.json`, and run `node scripts/verify-production-parity.mjs`. Any missing entry blocks cutover; `--summary` reports status without failure.

Visual differences may be documented only after owner approval. **Do not deploy to interplanetaryfund.com, merge to main or unpublish Base44 while this gate reports failures.**
