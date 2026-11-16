# Interplanetary Fund — GitHub / Cloudflare deployment register

**Snapshot:** 2026-11-15 approximately 18:15 Pacific (2026-11-16 02:15 UTC). **Read-only, source-of-record check against the Cloudflare Pages API and canonical GitHub repository.** This is an observation, **not** a deployment approval or a statement that all application routes work. Cloudflare states are transient; check the live API before acting.

## Canonical deployments

- **Repository:** [interplanetarysister/InterplanetaryFund](https://github.com/interplanetarysister/InterplanetaryFund)
- **Public domain:** https://interplanetaryfund.com
- **Cloudflare account / Pages project:** `c95db4f2c901f32776471b85f1eda15d` / `interplanetaryfund-migration`
- **Pages production branch:** `main`
- **Source:** GitHub
- **Git integration settings (verified):** `deployments_enabled=true`; `production_deployments_enabled=true`; `preview_deployment_setting=none`. The owner lifted the blanket **production build** hold on November 15. **This does not authorize** a broad feature-branch merge, unverified migration, production payment change, or unsafe feature flag activation.
- **Published account-deletion baseline:** Cloudflare deployment [`aca4c14b-eb76-403c-b39e-6aa52ecd37af`](https://dash.cloudflare.com/c95db4f2c901f32776471b85f1eda15d/pages/view/interplanetaryfund-migration/aca4c14b-eb76-403c-b39e-6aa52ecd37af), commit `33c3a073fbc596b63ed260341a0013a266c3d09d`, production, **deploy success**, November 15 about 16:06 PT. Its `/delete-account` release had separate owner-reported visual confirmation; completion of account erasure is **not** certified.
- **More recent successful production deployment (as of this snapshot):** `309102f3-9b38-437c-9658-b98a05e7bf60`, commit `56c61ce4408e4c3a99afeece87270b7c98d5ce79`, **deploy success**, November 15 about 18:14 PT, deployment URL https://309102f3.interplanetaryfund-migration.pages.dev. Its scope and application acceptance have **not** been independently checked.
- **Newer production build in progress:** `10291edf-9281-42ca-adf8-a89c486292e0`, commit `dd375a15811395b652c46b6abd7e57981a9780e4`, status **build active**, deploy idle at snapshot. **Do not mark deployed.**
- **Newest queued production build:** `e811fdb5-98d3-42f6-a259-e7ecf44c1198`, commit `3f01b0d4351a2b1f9e2f162b0702a69132ff2d5e`, **queued active**, remaining stages idle. GitHub `main` head at this snapshot is this SHA. **Do not mark deployed.**
- **Newest previews:** `ad206b30-6003-4d2f-8f2d-d03aa540ddcc` (`de7ee410`) and `2f685108-30e4-4c13-83e0-b141ce06790d` (`a8799830`) are **idle** in Pages. An assigned preview URL does not imply a successful published build.
- **Previously successful scoped native/web preview:** `de2207cf-948c-4a5e-b5d1-dbd0e945f937`, commit `36289ef791ed3518443be99e69e4e0f61c163f64`, **preview success**, November 15. Owner reported Vite build and 64/64 mobile tests. This is **not** an Android or iOS native compiler, signed binary, device, or App Store/Play approval. A second successful preview `5fefd4a1-9e7a-4372-80c7-9d506988d642` references the same commit.

## GitHub branch / app readiness

At snapshot, GitHub `main` is `3f01b0d4351a2b1f9e2f162b0702a69132ff2d5e`. The active `feature/route-completion-20261113` branch was **727 commits ahead and 17 behind `main`**. Treat comparison counts as time-bound; main is changing. **Never merge the entire staging branch solely to sync deployments.**

The staged application route acceptance manifest last independently parsed in this coordination window contains **86 tracked paths, 83 `not_verified`, 3 `source_ready`**, with 9/10 admin paths not source-verified. `source_ready` is not backend, authenticated browser, or live acceptance. Production presence of any individual route does not certify all paths.

**Not yet certified:** shared-agent credential minimization/owner-scoped Worker persistence, private campaign document RLS/Storage and account erasure, atomic provider refund/capture ledger and replay, signed PayPal webhook coverage, complete website/admin route acceptance, Android/iOS native compiler and signing, device/deep-link tests, and store submission.

**Safety and ownership:** `IFUND_TEAM_CONTEXT_ENABLED` stays OFF pending independent tests. PayPal external partner gifts are provider-hosted, not iFund ledger-confirmed; 7% withdrawal fee applies only to existing first-party flows. Base44 APK and source are read-only. No deployment, payment, SQL or DNS change was performed to create this register.

## Source of truth / next check

1. [Cloudflare Pages project](https://dash.cloudflare.com/c95db4f2c901f32776471b85f1eda15d/pages/view/interplanetaryfund-migration): verify the **deployment stage** and exact commit; do not infer success from an assigned URL.
2. [GitHub main commits](https://github.com/interplanetarysister/InterplanetaryFund/commits/main) and [feature comparison](https://github.com/interplanetarysister/InterplanetaryFund/compare/main...feature/route-completion-20261113): inspect latest SHAs and file-level scope.
3. [Issue #203](https://github.com/interplanetarysister/InterplanetaryFund/issues/203): authoritative owner/agent implementation evidence, release decisions and blockers.
4. Before any selective production change, independently verify the intended `main` commit, Cloudflare deployment completion, rollback SHA, protected feature flags, and route/security acceptance.

**Evidence terminology:** `source committed` ≠ `test executed` ≠ `Cloudflare build succeeded` ≠ `production deploy succeeded` ≠ `feature accepted` ≠ `native store approved`.
