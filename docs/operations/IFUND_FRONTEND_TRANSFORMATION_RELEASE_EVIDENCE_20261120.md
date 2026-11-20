# Frontend transformation release evidence — 2026-11-20

## Release decision

**SOURCE COMPLETE AND PUSHED. LIVE RELEASE BLOCKED / UNVERIFIED.**

Canonical source: `interplanetarysister/InterplanetaryFund`, branch `main`.
Base commit: `0f34256e698da4fd9df8768c00583a157672279a`.
Transformation commit: `bf15a34a9dc519fc382b8b0cdde96da8cb7133dd`.
Remote `refs/heads/main` was verified at `bf15a34a9dc519fc382b8b0cdde96da8cb7133dd` immediately after the frontend push. This evidence document was then committed as `fc75612c1e7cee36f2146e0b712a77389b836da9`, which is the current remote `main`; it changes documentation only and does not alter the built frontend.
Working tree clean after the commits.

No Cloudflare preview or production deployment was created for this commit. The live site must not be described as having the new experience until a separately authorized manual release produces a deployment ID and role-specific live acceptance.

## Restored / implemented

- Public `/templates` gallery with 11 canonical categories and 6 styles, registered in `App.jsx` and `apps/web/ci/route-acceptance.json` as `not_verified`.
- Shared category artwork, truthful responsive template preview and prompt composer components.
- Prompt-first Home page using real `listActiveCampaigns` data, category shortcuts, template CTA, three-step explanation and preserved guest/PayPal/PWA paths.
- Dashboard prompt composer and nine-agent shortcut grid derived from canonical `AGENT_WORKSPACES` and `agentToolHref`; all nine identities preserved.
- Additive, guarded category/template prefill and live layout preview in the three-step campaign editor. No campaign theme is persisted because `ifund_campaigns` has no theme/template column.
- Cosmic Geometry panel/tap utilities and reduced-motion CSS; 44px minimum touch targets corrected across new and touched surfaces.
- Truthful copy replacing the unsupported “every platform” claim; no invented totals, activity, testimonials, partnerships or provider behavior.
- Windows-hostile `pageTips.js` / `PageTips.jsx` collision resolved by the verified rename to `pageTipsData.js`.
- Regression tests in `apps/web/tests/campaign-templates.test.mjs`.

Changed paths in commit `bf15a34a`:

- `apps/web/ci/route-acceptance.json`
- `apps/web/src/App.jsx`
- `apps/web/src/components/Layout.jsx`
- `apps/web/src/components/LegalFooter.jsx`
- `apps/web/src/components/agents/AgentFeatureLauncher.jsx`
- `apps/web/src/components/campaigns/CampaignCategoryGrid.jsx`
- `apps/web/src/components/campaigns/CampaignTemplatePreview.jsx`
- `apps/web/src/components/coach/PageTips.jsx`
- `apps/web/src/components/coach/pageTipsData.js`
- `apps/web/src/components/prompt/PromptComposer.jsx`
- `apps/web/src/index.css`
- `apps/web/src/lib/campaignTemplates.js`
- `apps/web/src/pages/CampaignTemplates.jsx`
- `apps/web/src/pages/CreateCampaign.jsx`
- `apps/web/src/pages/Dashboard.jsx`
- `apps/web/src/pages/Home.jsx`
- `apps/web/tests/campaign-templates.test.mjs`

## Tests executed

- `node .\node_modules\vite\bin\vite.js build` from `apps/web`: passed; 2,664 modules transformed.
- `node apps/web/scripts/run-web-tests-summary.mjs`: **1047/1047 passed, 0 failed**.
- Backend suite (`node --test tests/*.test.js tests/*.test.mjs worker/agents/*.test.mjs workers/ifund-payments/*.test.mjs integrations/*.test.mjs`): **1026/1026 passed, 0 failed**.
- Local Playwright sweep against the freshly built `dist` preview: **35 viewport/page combinations, 0 problems**. Widths 320, 375, 390, 430, 768, 1024 and 1365; pages `/`, `/templates`, `/discover`, `/create?manual=1` and `/dashboard`. No 404s, page errors, horizontal overflow or sub-44px targets.
- Interaction smoke: template category/style state, 390px preview, category/template prefill in the editor, Home prompt/category/template links and guest Dashboard navigation all behaved as intended.
- No GitHub-hosted Actions were run.

## Live or preview verified

- **Local immutable-artifact preview only.** The browser sweep exercised the built `dist` through `vite preview` on loopback.
- **Cloudflare preview: NOT PERFORMED.** No deployment ID exists for `bf15a34a`.
- **Production: NOT PERFORMED.** The previously successful production deployment remains unchanged; this commit is not live.
- Role acceptance: only unauthenticated read-only/guest navigation was exercised locally. No authenticated member, owner, non-owner, admin or super-admin live acceptance was performed.

## Blocked / unverified

- Cloudflare local auth: no `wrangler` installation, no `~/.wrangler` config, and no `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_ACCOUNT_ID` or `CLOUDFLARE_TOKEN` environment variables. A manual Cloudflare release therefore cannot be executed from this workspace.
- GitHub CLI is authenticated, but dispatching the Cloudflare Pages workflow would consume the prohibited GitHub Actions minutes and is not the authorized manual Cloudflare path.
- All role-specific and privileged browser acceptances are **BLOCKED / UNVERIFIED** pending legitimate test identities and access: member/owner campaign drafting and publishing, non-owner denial, admin/super-admin actions, and paid/financial flows.
- Hosted inference validation for STORY, STRATEGY, GROWTH and Communications is **BLOCKED / UNVERIFIED** pending sandbox/provider receipts.
- LINK and DISCOVER provider OAuth are **BLOCKED / UNVERIFIED** pending real provider grants.
- Team context remains disabled (`IFUND_TEAM_CONTEXT_ENABLED=disabled`) pending a Worker secret and cross-account isolation acceptance.
- Paid campaign email remains inactive: no live $1 Basic add-on PayPal plan, no signed webhook ID, no verified inbound alias routing and zero active aliases.
- Production database migrations were not applied or inspected against live state in this release turn.
- `/templates` remains `not_verified` in the route-acceptance inventory; build and local smoke do not upgrade it to live acceptance.

## Unresolved history / preservation

- The verified builder skill at `.opencode/skills/ifund-browser-access/SKILL.md` and the independent website-agent policy at `docs/agents/skills/browser-access/SKILL.md` remain in their distinct locations. No duplicate-file deletion was performed by similarity alone.
- The local duplicate agent-operations migration was previously removed only after confirming the upstream canonical migration; the separate public-revocation migration was retained. No new SQL or financial record was changed in this transformation.
- Remote branches `origin/fix/creator-step3-score-separation-20261120` and `origin/integration/ux-accessibility-batch-20261120` remain unreviewed and were not merged.
- No source claim in this document establishes production behavior, provider authorization or verified funds.

## Rollback / restore references

- Previous clean `main`: `0f34256e698da4fd9df8768c00583a157672279a`.
- Owner Phase-1 backup branch: `backup/main-phase1-20261120` at `7fc04d97290c96923bf81e8efc0b281d97826c2a`.
- No destructive Git operation, DNS change, mail change, provider mutation or production database mutation was performed.
