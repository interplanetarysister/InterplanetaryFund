# IFund Help Center — implementation and editorial handoff

Updated: 2026-10-11. Source: authoritative Base44 Interplanetary Fund app, main branch.

## What exists

- Public Help Center: /help. Responsive page, category cards, query-string search (?q=), category filtering (?category=), and support access.
- Published article route: /help/:slug. Published slugs are treated as permanent because mobile and external links rely on them.
- Admin editor: /admin/help. AdminRoute plus Base44 entity-level access protection.
- Category taxonomy and page-context Help links: src/lib/helpCenter.js.
- Existing createSupportTicket backend preserved for signed-in visitors. Unauthenticated users are linked to /contact.
- Article feedback stored in HelpFeedback, accessible to its own author and administrators.
- Article contents fetched from Base44 at runtime, not hard-coded in app downloads. No native app binary produced.

## Data/security model

1. HelpDraft: admin-only read/create/update/delete. Unpublished working material.
2. HelpArticle: publicly readable and admin-only writable. All records in this entity are immediately public; never store private drafts or secrets here.
3. HelpFeedback: user-owned ratings, administrator-readable.
4. SupportTicket: existing private support records. Never include in public article search.

The editor requires an explicit Publish action; saving a draft does not publish. Publication requires an article title, valid slug and nonempty content, and checks for slug collisions. Editing a live article uses its original record and keeps its URL.

## Future article backlog — not yet written

- Donation succeeded but the campaign total didn't update
- Connecting outside platforms and verifying provider authorization
- Posting or publishing to connected accounts
- Creating, editing and sharing campaigns
- Donation receipts, fees and payment methods
- Balances and withdrawals
- Sign-in, recovery and account security
- Subscription billing
- AI assistance and consent
- Profiles, communities and groups

Before publication, validate all guidance against actual current capabilities, provider approvals, and product policies. Do not misrepresent plans as live functionality. Payment, withdrawal, privacy, and security articles require authorized human review.

## Deployment and app-link verification still needed

- Confirm the Base44 live published build separately. A passing source build is not proof that the public domain has been updated.
- Installed web/PWA app points to the same web-hosted /help and /help/:slug routes. If a separate Android native package is later used, link to the verified official HTTPS help URL, preferably using a Custom Tab.
- Test guests, logged-in users and unauthorized admin attempts, including draft access restrictions.
- Test publish end-to-end, permanent links, feedback, and actual support-ticket submission.
- Check small-screen contrast, keyboard focus, scrolling, and search relevance.
- Never seed mock help pages as though they are finished.

## Verification completed

- node scripts/verify-help-center-scaffold.mjs — passed.
- npm run build — passed, including production bundle, routes/assets, mobile/payment UX, provider and sustainability checks.
- Sandbox Node 24.21.0 produced a tested-lane warning because established lanes are Node 20/22, but the build succeeded.
- True live deployment, public browser rendering and authenticated end-to-end operations are not yet verified.
- Browser-render tests now pass: Chromium and Linux shared libraries were installed into the transient sandbox. Both the existing site smoke test and the dedicated Help Center browser test passed at 390px and 1280px with category filtering and guest navigation; this does not prove a deployed/live browser release.
- The current published interplanetaryfund.com and workers.dev help pages were inspected in Chromium and do not yet show the new Help Center: they continue serving a previous build and permission gate.
- A separate zero-deploy Cloudflare publishing validation command now exists: npm run publish:cloudflare:validate; see docs/AGENT_DEPENDENCIES_DIRECT_PUBLISHING.md.
