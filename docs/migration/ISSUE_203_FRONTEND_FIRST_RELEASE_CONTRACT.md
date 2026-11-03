# Issue #203 — frontend-first integration contract (2026-11-03)

## Release invariant
The visual and functional reference is `interplanetarysister/interplanetary-fund2@main`. The deployable repository is `interplanetarysister/InterplanetaryFund`; integration target `migration/base44-frontend-parity-20261103`. **No reconstructed frontend may substitute for source parity.** Preserve the original working Base44 SDK, auth, data and function connections until the owner authorizes migration of a specific entire dependency unit.

## Ownership and merge handoff
- Frontend owner: `agent/frontend-parity`, original source pages, images, CSS, mobile navigation and AI wizard. Existing PR #204 is a narrow hero-image change, not proof of a complete source transplant.
- Backend owner: `agent/backend-migration`, read-only inventory and backend QA during frontend restoration. Do not replace Base44 SDK/functions yet.
- Lead owner: `agent/lead-architecture`, inventory, integration contracts and code review only. Do not write to other agents' branches.
- Integration/QA owner: `migration/base44-frontend-parity-20261103`, conflict-aware merges, test and deployment validation. Never force-push, rebase others, or merge unreviewed branches.

Before each edit, re-fetch the destination branch head and open PRs; record overlapping files and resolve conflicts deliberately. No direct production deployment.

## Source-to-preview acceptance evidence (all required)
1. Record immutable source and destination commit SHAs; list original routes, page components, assets, SDK imports and navigation targets. Identify every omitted or substituted page explicitly.
2. Confirm Cloudflare Pages project `interplanetaryfund-migration` builds the intended original frontend entry point, not the reconstructed `apps/web` by accident. Inspect `root_dir`, `build_command`, `destination_dir` and GitHub source branch on each preview deployment.
3. Confirm Cloudflare deployment latest stage is `deploy:success`, not queued or build failure; verify the URL responds with a real document, correct assets and SPA route fallback.
4. Compare actual screenshots at mobile widths 360px and 390px, tablet 768px and desktop 1280px: homepage hero, navigation, discovery, campaign detail, guest creation, AI wizard, sign-in, recovery. Check horizontal overflow, safe areas, keyboard focus, touch targets, scrolling and Android viewport behavior.
5. Exercise guest discovery and campaign composition without login. Saving/posting prompts sign-up and returns to the same draft with text and generated selections intact. Verify owner-only access and nonowner denial separately.
6. Test working Base44 preview connections end to end before modifying any adapter. Never mark a simulated, mocked, or failed service response as successful.
7. Run both applicable frontend test suites, production builds, redirect smoke tests and security tests. Capture exact commit, test counts, CI URL, preview URL, runtime outcomes and unresolved blockers on issue #203.

## Auth and money boundaries
- Never create a duplicate super-admin identity or modify permissions while troubleshooting password recovery. Preserve existing Supabase and Base44 identities; recovery email may contain a link rather than a code until the provider template is verified.
- No live PayPal activation or fabricated donation records. Platform fee is 7% **at withdrawal**, restricted to campaign owner; enforce RLS and provider verification when a later authorized backend unit is migrated.

## Promotion and rollback
Only propose promotion after the owner has seen and approved a verified original-frontend preview, with a known-good deployment ID and documented rollback target. Preserve DNS and original Base44 functionality until explicit approval. Passing CI alone is insufficient.
