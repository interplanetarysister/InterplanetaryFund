# IFund migration agent rules
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137), superseding all older instructions.

- Integration branch `migration/supabase-cloudflare` starts at reset `main`; phase PRs target that branch. Do not merge obsolete PR #136.
- `interplanetarysister/interplanetary-fund2` is the **read-only source**. Historical archive branch is reference, not build policy. Do not copy `migration-reference/`.
- Stack: Supabase Postgres/Auth/Storage/Edge Functions, Cloudflare Pages frontend and Workers API. Wix retains marketing site until separately authorized DNS cutover. No Base44/Convex runtime in replacement.
- Owner directive, 2026-11-01: deployments are authorized for the duration of this build; do not request deployment confirmation again. Verify each replacement before switching its production traffic. Other data/provider/cost controls remain applicable. Never commit credentials, tokens, service-role keys, sensitive user rows, private exports or receipts.
- Preview frontend source is `apps/web`: supply executable JSX, CSS, behavior and actual assets. Cloudflare compiles and serves that code; it does not infer a design from prose. Use `npm run build:preview` and the verified `apps/web/dist` artifact. The root `src` scaffold is a separate implementation and must not be mistaken for the original frontend port.
- Owner-approved presentation deviations (2026-11-01): retain the updated agent icons and space-themed page titles from the current preview. Integrate these as display changes while preserving route identities, permissions, business behavior and the original platform structure. An owner-provided walkthrough video is additional visual evidence when supplied.
- Preserve existing `ifund_ops` workflow tables and shadow/private schema. Schema files require independent review and staging tests before any application.
- Implement role and identity authorization server-side; financial ledgers and payment callbacks require service-authoritative, audited, idempotent writes, strict RLS, and verified provider events. No privileged credentials in browsers.
- Every unverified dependency goes to `docs/migration/BLOCKERS.md`; continue independent work. Update `STATUS.md` and `INVENTORY.md` with evidence.
- One reviewable PR per phase, under 300 changed files, with test evidence and truthful completion claims. No auto-merge, no production cutover until all seven gates pass.
