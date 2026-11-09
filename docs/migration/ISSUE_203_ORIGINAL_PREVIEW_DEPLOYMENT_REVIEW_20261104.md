# Issue #203 — original-source preview deployment review (2026-11-04 UTC)

Scope: lead architect, non-overlapping review only. **No production approval or Base44 runtime migration.**

## Inspected evidence
- Integration ref: `b0b17b837198dd85b9e40a99d6a8a681132c1b52`.
- `agent/frontend-parity` differs from integration only in `.github/workflows/original-frontend-preview.yml` and a six-line Home change; 15 ahead, 1 behind. This does **not** port original source into the deployable repository.
- `agent/lead-architecture`: 11 ahead, 1 behind integration, architecture/audit files only.
- Frontend preview workflow checks out `interplanetarysister/interplanetary-fund2` at an explicitly supplied immutable SHA, builds it with Base44 variables, writes `dist/ifund-source.json`, and deploys with `wrangler pages deploy` to the existing Pages project on `original-frontend-preview` branch. It then probes source metadata, homepage, and /login.
- A successful probe proves provenance and SPA fallback only. It does not prove that Base44 requests work, the login callback origin is allowed, or that mobile routes look like the original app.

## Required handoffs
1. **Frontend owner:** Record the exact original source SHA, action run, Pages deployment ID, and immutable URL. Show that the Pages project routes `original-frontend-preview` only to an isolated preview hostname; verify it cannot alter `interplanetaryfund.com` or the production branch alias. If that isolation cannot be demonstrated, use a separate preview Pages project before deploying.
2. **Frontend owner:** Produce a manifest of original routes/assets/components and compare against the served artifact, not just `apps/web`; preserve original Base44 SDK/functions, campaign wizard, backgrounds, mobile navigation and safe-area behavior.
3. **Integration QA:** Capture screenshots at 375px and 390px widths for home, discover, campaign detail, campaign creation, login/recovery, and navigation. Test browser console/network errors, deep links and reloads, guest browsing/composition, login-to-draft restoration, and Base44-connected read/write on a nonfinancial test campaign.
4. **Backend QA:** Confirm Base44 allowed origins/callback URLs and Supabase redirects without changing production credentials. Validate RLS, owner-only financial visibility and withdrawal-only 7% fee independently. Do not enable payments or replace any Base44 functional unit without separate owner authorization.
5. **Release owner:** Attach actual preview URL and test evidence to issue #203, obtain explicit owner approval and document rollback target before any production promotion.

## Release decision
**HOLD.** Source-pinned deployment machinery is useful but is not evidence of a restored, working frontend. Do not merge other agents' branches without review, force-push, delete existing services, or promote the isolated preview on the strength of HTTP 200 alone.
