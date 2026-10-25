# Connected runtime audit — 2026-10-25

Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137). Read-only verification of **actual connected services**, not a claim of full migration or authorization to unpublish Base44.

## Cloudflare (verified through authorized account API)

- Zone `interplanetaryfund.com` is **active** with Cloudflare nameservers `angelina.ns.cloudflare.com` and `ed.ns.cloudflare.com`.
- Apex, `www`, and `preview` DNS CNAMEs are proxied to `interplanetaryfund-migration.pages.dev`. Three Cloudflare MX records and SPF/DKIM TXT records are present. These records do **not** prove two-way internal-inbox email delivery.
- Pages project: `interplanetaryfund-migration`; GitHub source repo: `interplanetarysister/InterplanetaryFund`; configured production branch: `migration/phase7-offline-cutover-gate`.
- Pages source configuration reports `production_deployments_enabled: false` and `deployments_enabled: true`. The recent deployments inspected were previews. This is **not verified production release readiness**.
- Pages production build variable `VITE_SUPABASE_URL` still targets the older project `tzehxfikoslihnclhxuz`, not the designated replacement project. **Do not switch it merely to silence a check:** the replacement project's public campaign, account and post tables are empty until verified owner linking, data parity and end-to-end tests.
- Cloudflare Workers scripts exist, including `interplanetary-fund2`, `ifund-oauth` and `ifund-email-ingress`. Presence of scripts does not demonstrate no Base44 upstreams, correct routing, or deployed new API parity.
- Secrets and secret values were not exported, printed, or committed.

## Designated Supabase replacement (verified through connected project API)

- Project `ssibsfmtodgximseeqsv` (`InterplanetaryFund`) is `ACTIVE_HEALTHY`.
- Independent catalog count: **79** `ifund_stage` entity tables + **12** `ifund_finance` + **4** `ifund_secrets` = **95** private entity tables; all **95** have PostgreSQL RLS enabled.
- Also **4** private `ifund_transfer` tables and **4** `public.ifund_*` app tables, all with RLS enabled. Table existence and RLS do **not** prove correct role-policy parity with Base44.
- The four public app tables have **zero** rows in the connected table summary. The replacement project reports **zero deployed Supabase Edge Functions**. A security advisor scan returned **zero findings**, which does not constitute authorization, payment or business-logic verification.
- Private legacy transfer details and the **27/27 semantic structural comparison** are recorded in [TABLE_POPULATION_STATUS_20261025.md](TABLE_POPULATION_STATUS_20261025.md); nine raw serialized digests remain different and no source-byte-identical claim is made.
- The earlier `tzehxfikoslihnclhxuz` Supabase project is a **different** project; never conflate source shadow records with production-readiness of the new project.

## Confirmed legacy Worker routing

A follow-up read of the **currently deployed** Cloudflare Worker `interplanetary-fund2` and zone routes found:

- Fourteen hostname/path patterns for apex or `www.interplanetaryfund.com` currently bind to `interplanetary-fund2`. Patterns include `/api/mcp*`, `/api/v1/migration/auth/session`, `/api/v1/migration/campaigns`, `/api/health*`, agent and OAuth discovery paths.
- The Worker **contains** `DEFAULT_BASE44_ORIGIN = "https://interplanetaryfund.base44.app"` and a `proxyBase44Mcp` routine that constructs and fetches upstream requests. Thus a Base44-independent runtime **cannot be claimed** from Cloudflare DNS or Pages setup alone.
- The Worker readiness implementation explicitly names `base44_mcp_proxy`, `base44_auth_authority`, and `base44_campaign_authority` as missing independent capabilities. This is an operational dependency, not just a dead import in an archived source file.
- **Do not delete the Worker or routes yet.** Replace one route at a time with verified Supabase/Cloudflare behavior and prove auth/ownership, audit and payment controls before disabling any still-active legacy fallback. Keep the existing live paths from breaking while the replacement remains incomplete.

## Blocking cutover gates

1. Independently prove user sign-in and verified owner-to-`auth.users` mapping, plus cross-account RLS denial.
2. Verify a versioned complete source record and media transfer; transfer the remaining 266 content shadows and 42 source records only with reviewed private import controls. Reconcile provider transactions, ledger and withdrawal history independently.
3. Port/retire the still-missing Base44 functions, workflows, agents and frontend pages, and verify that no active Worker/Pages route proxies to `base44.app`.
4. Test campaign creation, draft save, publish, public viewing, and role authorization in the replacement stack before changing its Pages environment to the destination database.
5. Separately verify PayPal merchant permissions, signed sandbox webhooks, idempotent financial ledger, funding custody model and payout eligibility before enabling donor checkout or withdrawals.
6. Complete owner review/ordered PR merges under issue #137. Do not merge obsolete #136, do not activate an incomplete build as production, and do not unpublish Base44 until the definition-of-done gates pass.

## CI clean-up

A single-use GitHub Actions formatter was run on this branch to repair four previously failing Prettier paths (`src/lib/legalPolicy.js`, `src/pages/About.jsx`, `src/pages/Privacy.jsx`, `src/pages/Terms.jsx`); the formatter succeeded and removed its own workflow file. This audit-file commit permits a fresh PR check against the updated head. Treat the check as passing **only after** GitHub reports a completed successful run.

No database mutation, provider setting, DNS record, Cloudflare Pages production setting, payment, deployment, or secret was changed by this audit.
