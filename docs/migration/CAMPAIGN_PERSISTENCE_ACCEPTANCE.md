# Campaign persistence acceptance and security checks

Scope: Cloudflare Pages preview + Supabase project `tzehxfikoslihnclhxuz`. This is a **review and test plan**, not proof of live functionality. Do not apply schema to the existing Supabase project before independent review and staging tests. Preserve `ifund_ops`, existing mail tables, and historical user data.

## Source-to-schema contract verified in code (2026-10-25)

- `src/pages/CampaignEditor.jsx`: `ifund_campaigns` inserts with `owner_id=user.id`, updates only matching `id` and `owner_id`, selects `id`; draft accepts incomplete content; active publish validates title, summary, story, and goal > 0.
- `src/pages/MyCampaigns.jsx`: reads owner rows ordered by `created_at`.
- `src/pages/Feed.jsx` and `Discover.jsx`: only `status=active` campaigns shown publicly.
- `src/pages/Community.jsx`: `ifund_posts` reads and owner-authored inserts.
- `src/pages/Auth.jsx`: email OTP + OAuth; verify Supabase project URL allowlist and provider configuration; do not assume working because buttons render.
- Proposed schema is `docs/migration/CAMPAIGN_RUNTIME_SCHEMA_REVIEW.sql`. **Do not mistake this proposal for a deployed migration.**

## Staging acceptance matrix (must execute with actual auth sessions)

| Actor | Operation | Expected |
| --- | --- | --- |
| Unauthenticated | SELECT active campaign | Allowed |
| Unauthenticated | SELECT draft | Denied/no rows |
| Unauthenticated | INSERT/UPDATE/DELETE campaign | Denied |
| User A | INSERT own incomplete draft | Allowed |
| User A | Reload own draft by id | Allowed |
| User A | Publish incomplete draft | Rejected |
| User A | Publish completed draft, reload | Allowed, public visible |
| User A | Edit own campaign | Allowed |
| User B | SELECT User A draft | Denied/no rows |
| User B | UPDATE/DELETE User A campaign | Denied |
| User A | Change owner_id to User B | Denied |
| Unauthenticated | Read community posts | Allowed |
| User A | Create own community post | Allowed |
| User B | Delete User A post | Denied |

## Deployment gates

1. Independent review of RLS, table constraints, function grants, and interaction with existing schema.
2. Validate against a separate staging Supabase project or isolated transaction and inspect advisors; never run destructive tests against live user data.
3. Apply reviewed schema with recorded migration history only after authorization.
4. Confirm `public` Data API exposure, grants, and RLS policies.
5. Verify email OTP delivery/template and OAuth redirect URLs for the Cloudflare preview origin.
6. Browser-test draft save, reload, edit, publish, and community post with two test accounts and an unauthenticated session.
7. Confirm no service-role keys or financial mutation endpoints are exposed.
8. Reconcile historical Base44 campaigns and owner links before any cutover; don't treat shadow copies as authoritative.
9. Record results and failures in `docs/migration/BLOCKERS.md`; retain domain and Base44 runtime until all seven issue #137 gates pass.

## Remaining implementation risks

- Cloudflare deploy success only proves the static build; not backend writes.
- `ifund_campaigns` and `ifund_posts` are not present in current `public` tables (read-only inspection).
- This phase branch stacks on unmerged phase-2 changes, so the PR diff is larger than the new file.
- SQL trigger uses a public function with revoked direct execution; confirm PostgreSQL trigger invocation and function ownership in staging.
- Supabase Auth anonymous sign-in, if enabled, must be explicitly assessed against the intended account ownership policy.
