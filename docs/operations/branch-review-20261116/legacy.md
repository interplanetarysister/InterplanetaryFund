# Legacy ahead-branch review

Baseline main: `20f98c4c0a60a751be35d441405454f69ba779d8`. Reviewed 78 branches. Source/history review only; no runtime deployment claims.

All reviewed branches lack direct changes to the canonical apps/web, Workers or Supabase surfaces. Do not restore deleted Convex, FundForge, Vercel pipelines or old canonical-ownership documents. Preserve their commits and resolve obsolete source against current main. Any history-only merge must be recorded as retired/superseded, not a feature passing live acceptance.

## Current concerns to carry forward

- Port dependency-audit intent to canonical package locks with fail-closed npm error handling; old verifier treats missing metadata as zero findings.
- Current workflows still use checkout/setup-node v4. Inventory branch is not an upgrade; validate current supported action runtimes before claiming that historical task complete.
- Current dependency locks require independent audit; obsolete Dependabot locks must not replace current Supabase manifests.

## Branch accounting

### agent1/admin-auth-hardcoded-pin-guard

Head `43a45427743ce760fc24523782f976913a7ffbf3`; 3 ahead / 2083 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `package.json`, `scripts/verify-admin-auth-boundary.mjs`.

### agent1/admin-pin-bootstrap-guard

Head `71de3569947a2f30ba52d2bd110570cf1f54d186`; 1 ahead / 2076 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `scripts/verify-admin-pin-bootstrap-boundary.mjs`.

### agent1/admin-pin-fail-closed-current-main

Head `2909ee3e41d30e0c4a3fd165d9f25ae0e66df9ee`; 5 ahead / 2088 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/admin-pin-security.yml`, `convex/auth.ts`, `convex/security.ts`, `scripts/verify-admin-pin-security.mjs`.

### agent1/admin-pin-init-security

Head `15cc4775045030fed05caef3f3ca2b36158dc2bf`; 5 ahead / 2147 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/admin-pin-bootstrap.yml`, `convex/security.ts`, `package.json`, `scripts/verify-admin-pin-security.mjs`.

### agent1/admin-setting-auth-current-main

Head `724cd38ff706625e24ba395f54b09ebfeb85a88d`; 1 ahead / 2090 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/security.ts`.

### agent1/admin-settings-security

Head `97eacac9accf0c720ae12bc6ae09147bdded390a`; 5 ahead / 2147 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/admin-settings-identity-security.yml`, `convex/security.ts`, `scripts/verify-admin-settings-identity-security.mjs`.

### agent1/admin-settings-verification

Head `4581610329550225c3f00d4ef93e6b84f51df300`; 2 ahead / 2147 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/security.ts`, `scripts/verify-admin-settings-security.mjs`.

### agent1/agent-automation-authorization

Head `27a2a877aba3bac834c72cb3bbfeffc695d94008`; 3 ahead / 2147 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/agentAutomationAuthorization.ts`, `package.json`, `scripts/verify-agent-automation-authorization.mjs`.

### agent1/agent-automation-authorization-migration

Head `ae4fe1873c2da79cdd092d72133bdc3a67a48787`; 4 ahead / 2147 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/agentAutomationAuthorization.ts`, `package.json`, `scripts/verify-agent-automation-authorization.mjs`, `src/pages/Agents.tsx`.

### agent1/apk-signing-security

Head `48bdc1a0bcbe244eaeeb7bcdbd85aae881f486ee`; 1 ahead / 2089 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/build-apk.yml`.

### agent1/automation-concurrency-current-main

Head `03f987e945d415c51c0713664c3ee94b9462ae87`; 18 ahead / 2091 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/backend-quality.yml`, `convex/_generated/api.d.ts`, `convex/automationCoordinator.ts`, `convex/crons.ts`, `docs/CONVEX_AUTOMATION_CONCURRENCY_DEVELOPMENT.md`, `package.json`, `scripts/verify-automation-concurrency.mjs`, `scripts/verify-automation-serialization.mjs`, `tsconfig.convex.json`.

### agent1/automation-concurrency-reconciled

Head `d4fa84be56257108955b21093ae7d17f21b98b3c`; 11 ahead / 2136 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/backend-quality.yml`, `convex/_generated/api.d.ts`, `convex/automationCoordinator.ts`, `convex/crons.ts`, `docs/CONVEX_AUTOMATION_CONCURRENCY_DEVELOPMENT.md`, `package.json`, `scripts/verify-automation-concurrency.mjs`, `scripts/verify-automation-serialization.mjs`, `tsconfig.convex.json`.

### agent1/automation-concurrency-repair

Head `bf3f621a0aeba8a50e90734ef695d038678bf9db`; 38 ahead / 2149 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/backend-quality.yml`, `convex/_generated/api.d.ts`, `convex/automationCoordinator.ts`, `convex/crons.ts`, `docs/CONVEX_AUTOMATION_CONCURRENCY_DEVELOPMENT.md`, `package.json`, `scripts/verify-automation-concurrency.mjs`, `scripts/verify-automation-serialization.mjs`, `tsconfig.convex.json`.

### agent1/campaign-regenerate-preview

Head `6bb8d6ce2fd17464fa9b92fa331bd7472836b247`; 1 ahead / 2081 behind at review.

Changes retired src/pages/AICampaignWizard.tsx. Canonical CreateCampaign already has per-section regeneration and reviewed copy application, with privacy and concurrent-writing guards.

Changed paths: `src/pages/AICampaignWizard.tsx`.

### agent1/ci-node24-and-apk-signing-current-main

Head `d84c5f8eeb78b501aef13f7afadc82d5028cea2b`; 8 ahead / 2088 behind at review.

Changes workflows that are deleted on main, generally upgrading old Convex/Base44 pipeline runtimes. Canonical workflows have distinct current manual trigger/release controls; preserve them and do not revive old CI.

Changed paths: `.github/workflows/apply-consolidation-fix-v2.yml`, `.github/workflows/build-apk.yml`, `.github/workflows/convex-deploy.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/enhanced-agent.yml`, `.github/workflows/qa-testing.yml`, `.github/workflows/verify-apk-build.yml`, `.github/workflows/verify-node24-actions.yml`.

### agent1/consolidation-summary-auth-current-main

Head `a5e681b4f19f5bd34ea274862b283b72a4d34375`; 3 ahead / 2091 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/consolidation-summary-auth.yml`, `convex/fundConsolidation.ts`, `scripts/verify-consolidation-summary-auth.mjs`.

### agent1/consolidation-summary-auth-verifier-correction

Head `4b9951f7a30cf53d44b46760081885fb55e8a60c`; 4 ahead / 2091 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/consolidation-summary-auth.yml`, `convex/fundConsolidation.ts`, `scripts/verify-consolidation-summary-auth.mjs`.

### agent1/consolidation-summary-auth-verifier-v2

Head `5f1a4437ee71481c9ab4fd63da3e1d0ee08bf94d`; 7 ahead / 2091 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/consolidation-summary-auth.yml`, `convex/fundConsolidation.ts`, `scripts/verify-consolidation-summary-auth.mjs`.

### agent1/convex-concurrency-first-pass

Head `551b4c91240ba54a1944b6e847e98b259e5caae6`; 1 ahead / 2150 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/crons.ts`.

### agent1/feature-10-platform-foundation

Head `27923918ae2dfdd18b5bb56cda8ea821d59e60fa`; 15 ahead / 2161 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/quality.yml`, `convex/http.ts`, `convex/platformFoundation.ts`, `docs/FEATURE_10_PLATFORM_BRIDGE.md`, `package.json`, `scripts/verify-platform-runtime.mjs`, `src/types/three.d.ts`.

### agent1/fix-form-input-contrast

Head `167918bd79ee579b76e2fa3f5436a92f70ee0fcb`; 4 ahead / 2041 behind at review.

Changes only retired fundforge input/select/textarea/CSS. Canonical apps/web already has bg-background, text-foreground, caret, placeholder, autofill and focus guards.

Changed paths: `fundforge/src/components/ui/input.jsx`, `fundforge/src/components/ui/select.jsx`, `fundforge/src/components/ui/textarea.jsx`, `fundforge/src/index.css`.

### agent1/fix-three-types-current-main

Head `71f1d6337e96ce98bd626616af16a9d158fb1e62`; 1 ahead / 2079 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `src/types/three.d.ts`.

### agent1/fix-three-types-current-main-v2

Head `7584d0fac9f03437cecf039a350b17cdf831a485`; 1 ahead / 2078 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `src/types/three.d.ts`.

### agent1/fund-consolidation-integrity-guard

Head `9a69877d401988b6439434b6af680f69a44fd25e`; 13 ahead / 2135 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/fund-consolidation-integrity.yml`, `convex/fundConsolidation.concurrency.test.ts`, `convex/fundConsolidation.ts`, `docs/PAGE_TITLE_REGISTRY.html`, `scripts/verify-fund-consolidation-integrity.mjs`.

### agent1/fund-consolidation-summary-auth

Head `4d61218a02e4253604c1f337cc14f2a4a4ed82fd`; 2 ahead / 2132 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/consolidation-summary-auth.yml`, `scripts/verify-consolidation-summary-auth.mjs`.

### agent1/fund-migration-auth

Head `1f1685bbde2662fa6313f65bd505bef83a378881`; 1 ahead / 2076 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/fundMigration.ts`.

### agent1/fund-migration-boundary-guard-r1

Head `451404fb7b2b0b52c105aa2b3476ac650378072d`; 4 ahead / 2076 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `scripts/verify-fund-migration-boundaries.mjs`.

### agent1/harden-admin-pin-verification

Head `093b29c29560772adc0a3f6593524ebd88e9f775`; 11 ahead / 2041 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/admin-auth-boundary.yml`, `.github/workflows/admin-credential-surface.yml`, `convex/adminUsers.ts`, `convex/auth.ts`, `convex/schema.ts`, `convex/security.ts`, `package.json`, `scripts/verify-admin-auth-boundary.mjs`, `scripts/verify-admin-credential-surface.mjs`, `src/types/three-runtime.d.ts`.

### agent1/node24-actions

Head `24383f2fab9e18845d46e6fcc83d28f5c79f38ec`; 6 ahead / 2090 behind at review.

Changes workflows that are deleted on main, generally upgrading old Convex/Base44 pipeline runtimes. Canonical workflows have distinct current manual trigger/release controls; preserve them and do not revive old CI.

Changed paths: `.github/workflows/build-apk.yml`, `.github/workflows/convex-deploy.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/enhanced-agent.yml`, `.github/workflows/qa-testing.yml`, `.github/workflows/verify-node24-actions.yml`.

### agent1/obo-integration-mandate

Head `8e91b39e38b26dc1455d69fb03d07fa03a515e58`; 1 ahead / 2120 behind at review.

Documentation only: permission/evidence/owner-finance invariants are covered by current AGENTS and build contract; implementation instructions explicitly mandate obsolete Convex/Vercel. Preserve historic mandate without overriding current architecture.

Changed paths: `docs/INTEGRATION_OBO_MANDATE.md`.

### agent1/p0-admin-auth-oracle-guard

Head `f9be2578e81ecccb6e2bfab0d085694b8277844a`; 2 ahead / 2083 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/admin-credential-surface.yml`, `scripts/verify-admin-credential-surface.mjs`.

### agent1/p0-convex-durable-claim-current-main-r13

Head `14a679be581099ffd2bb0e5ab63908993c35096b`; 48 ahead / 1999 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/exact-head-validation.yml`, `convex/_generated/api.d.ts`, `convex/agentAutomation.ts`, `convex/automationCoordinator.ts`, `convex/automationLease.ts`, `convex/automationProvisioning.ts`, `convex/autonomous.ts`, `convex/browserbase.ts`, `convex/crons.ts`, `convex/facebook.ts`, `convex/fundConsolidation.ts`, `convex/imageGen.ts`, `convex/postContent.ts`, `convex/protocol.ts`, `convex/protocolAutoFix.ts`, `convex/research.ts`, `package.json`, `scripts/verify-automation-provisioning.mjs`, `scripts/verify-automation-serialization.mjs`.

### agent1/p0-convex-durable-claim-r12

Head `474e8956c0472c579e6290d8896fec32310b46ba`; 10 ahead / 2079 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/_generated/api.d.ts`, `convex/automationCoordinator.ts`, `convex/crons.ts`, `docs/CONVEX_AUTOMATION_WRITESET_VALIDATION.md`, `package.json`, `scripts/verify-automation-concurrency.mjs`, `scripts/verify-automation-serialization.mjs`.

### agent1/p0-convex-serialization-current-main

Head `d4fdd90729c0868f70222f939fae36d8f614986e`; 14 ahead / 2087 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/_generated/api.d.ts`, `convex/automationCoordinator.ts`, `convex/crons.ts`, `docs/CONVEX_AUTOMATION_CONCURRENCY_DEVELOPMENT.md`, `docs/CONVEX_AUTOMATION_WRITESET_VALIDATION.md`, `package.json`, `scripts/verify-automation-concurrency.mjs`, `scripts/verify-automation-serialization.mjs`.

### agent1/p0-convex-serialization-current-main-r11

Head `5c4127960c80fc1a8a62991cdca590095da93c38`; 8 ahead / 2079 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/_generated/api.d.ts`, `convex/automationCoordinator.ts`, `convex/crons.ts`, `docs/CONVEX_AUTOMATION_WRITESET_VALIDATION.md`, `package.json`, `scripts/verify-automation-concurrency.mjs`, `scripts/verify-automation-serialization.mjs`.

### agent1/p0-current-main-ci-reconciliation

Head `b40864c64595bbad3c213f95ff3a9eee2abff006`; 9 ahead / 2088 behind at review.

Changes workflows that are deleted on main, generally upgrading old Convex/Base44 pipeline runtimes. Canonical workflows have distinct current manual trigger/release controls; preserve them and do not revive old CI.

Changed paths: `.github/workflows/apply-consolidation-fix-v2.yml`, `.github/workflows/build-apk.yml`, `.github/workflows/convex-deploy.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/enhanced-agent.yml`, `.github/workflows/qa-testing.yml`.

### agent1/p0-donation-api-reconciliation

Head `e25cee5d6ba55bbb7ebcc706d622b16f28b716ea`; 2 ahead / 2080 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/donation-api-reconciliation.yml`, `scripts/verify-donation-api-reconciliation.mjs`.

### agent1/p0-donation-completion-guard

Head `36ec70457e31af557d9a2e8fc6b67b341329204a`; 2 ahead / 2080 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/donation-completion-boundary.yml`, `scripts/verify-donation-completion-boundary.mjs`.

### agent1/p0-platform-repair-internalize

Head `80ee6b34d5aa57a3466dde5b9ef74d9eda0ae532`; 5 ahead / 2041 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/exact-head-validation.yml`, `convex/fixPlatforms.ts`, `src/types/three-runtime.d.ts`.

### agent1/p0-usercampaigns-rls-guard

Head `ba943c9c50e2198477ce758f2df892c58442c868`; 2 ahead / 2085 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/user-campaigns-identity-boundary.yml`, `scripts/verify-user-campaigns-identity-boundaries.mjs`.

### agent1/p0-withdrawal-auth-guard

Head `3e96374a3d6da1902dcc0f99c669e2cd90c32023`; 2 ahead / 2085 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `package.json`, `scripts/verify-non-stripe-withdrawal-boundary.mjs`.

### agent1/p0-withdrawal-auth-implementation

Head `c60358360950e14cd827c2cfc96925a587391b68`; 3 ahead / 2085 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/withdrawalMethods.ts`, `package.json`, `scripts/verify-non-stripe-withdrawal-boundary.mjs`.

### agent1/p1-agent-management-boundary

Head `cefe6fcb99f1d60bafcbea07c6b0b9501f959344`; 3 ahead / 2085 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `package.json`, `scripts/verify-agent-management-boundary.mjs`.

### agent1/p1-agent-management-implementation

Head `ed5b7bc14d52d814bfbbb50d2ce145699c30330f`; 7 ahead / 2085 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/agents.ts`, `package.json`, `scripts/verify-agent-management-boundary.mjs`.

### agent1/p1-agent-roster-boundary

Head `503138502b90cb384b4e0c7b715fdd7f7dddc2e0`; 6 ahead / 2087 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/agentAutomation.ts`, `convex/agents.ts`, `package.json`, `scripts/verify-agent-roster-boundary.mjs`, `scripts/verify-no-public-automation-telemetry.mjs`, `src/pages/Agents.tsx`.

### agent1/p1-automation-telemetry-ui-current-main

Head `b4d8c4854d510d942bd8129dfc1c68e84e37856c`; 8 ahead / 2041 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/exact-head-validation.yml`, `convex/agentAutomation.ts`, `package.json`, `scripts/verify-no-public-automation-telemetry.mjs`, `src/pages/Agents.tsx`, `src/types/three-runtime.d.ts`.

### agent1/p1-consolidation-history-auth-correction

Head `91991c7d6ecdf12bf016f66d2e9a3d9d264561a7`; 5 ahead / 2087 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/consolidation-history-auth.yml`, `convex/fundConsolidation.ts`, `package.json`, `scripts/verify-consolidation-history-auth.mjs`.

### agent1/p1-consolidation-history-auth-current-main

Head `997a0bf8d342bedf657d8847344b688737af550f`; 4 ahead / 2087 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/consolidation-history-auth.yml`, `package.json`, `scripts/verify-consolidation-history-auth.mjs`.

### agent1/p1-consolidation-mutation-auth-guard

Head `ff477c63256cb0a7c64944db1ad399d725547242`; 1 ahead / 2086 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `scripts/verify-fund-consolidation-authorization.mjs`.

### agent1/p1-dependency-audit-guard

Head `fda4189e9fc884b7a0849fc9ba478cfa7bb1a087`; 3 ahead / 2081 behind at review.

Generic dependency-audit intent is relevant, but old workflow audits old root only using Node20/Actions v4. Script can falsely pass an npm error JSON with missing metadata. Port a fail-closed audit gate to current package roots instead of merging old files unchanged.

Changed paths: `.github/workflows/dependency-audit.yml`, `scripts/verify-dependency-audit.mjs`.

### agent1/p1-exact-head-ci-current-main-r11

Head `d76fefb3da446e238fd6ef3aafa4069a51570aba`; 1 ahead / 2039 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/exact-head-validation.yml`, `src/types/three-runtime.d.ts`.

### agent1/p1-exact-head-ci-foundation

Head `09acdb1d13c61a14271e1a89c185c0a3f9eb41e1`; 3 ahead / 2082 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/exact-head-validation.yml`, `src/types/three.d.ts`.

### agent1/p1-node24-supported-workflows

Head `2ec2695729f62b3137588321993aff42d02ae237`; 1 ahead / 2038 behind at review.

Changes workflows that are deleted on main, generally upgrading old Convex/Base44 pipeline runtimes. Canonical workflows have distinct current manual trigger/release controls; preserve them and do not revive old CI.

Changed paths: `.github/workflows/convex-deploy.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/enhanced-agent.yml`.

### agent1/p2-action-runtime-audit

Head `80a1da6c0e4618d9a562f59495e0a6c4b5d787a7`; 2 ahead / 2082 behind at review.

Inventory-only gate intentionally fails all Actions v4 declarations. Source intent remains potentially relevant because current workflows still use checkout/setup-node v4, but wholesale restoration creates a failing legacy job and does not itself upgrade any runtime.

Changed paths: `.github/workflows/action-runtime-inventory.yml`, `scripts/verify-action-runtime-inventory.mjs`.

### agent1/public-active-campaign-owner-least-privilege

Head `ad7d03ad254e8329476e991caba0e39d68c36519`; 1 ahead / 2077 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `scripts/verify-public-campaign-owner-identifier.mjs`.

### agent1/public-campaign-least-privilege-current-main

Head `e37eb980d583f69770551d78d991a4199f221647`; 2 ahead / 2078 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/userCampaigns.ts`.

### agent1/qa-readonly-reporting

Head `31ef1deed820e9b64b876905acb22b7fd4866431`; 1 ahead / 2040 behind at review.

Removes or limits mutation/deployment in retired workflows/scripts. Their target workflows/scripts are absent on main; desired no-self-mutation boundary is satisfied by retirement. Do not recreate Convex deploy jobs.

Changed paths: `.github/workflows/qa-testing.yml`.

### agent1/reconcile-exact-head-node-runtime-20260924

Head `86eea6707e918903f8be96a4f17d469612da2900`; 1 ahead / 1984 behind at review.

Changes workflows that are deleted on main, generally upgrading old Convex/Base44 pipeline runtimes. Canonical workflows have distinct current manual trigger/release controls; preserve them and do not revive old CI.

Changed paths: `.github/workflows/exact-head-validation.yml`.

### agent1/remove-hardcoded-admin-pin-fallback

Head `7e50fcf8645c311989e98460bac2abfe6b8d7da0`; 9 ahead / 2146 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/admin-pin-security.yml`, `convex/auth.ts`, `convex/security.ts`, `package.json`, `scripts/verify-admin-pin-authorization.mjs`.

### agent1/remove-public-automation-status

Head `4780d0f7096c3975e8c5b1e67f255c25450c073c`; 3 ahead / 2087 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `package.json`, `scripts/verify-no-public-automation-telemetry.mjs`, `src/pages/Agents.tsx`.

### agent1/remove-self-mutating-patch-workflow

Head `2ab4d1af442e051f374b67469a97fd2b7a4831e7`; 1 ahead / 2088 behind at review.

Removes or limits mutation/deployment in retired workflows/scripts. Their target workflows/scripts are absent on main; desired no-self-mutation boundary is satisfied by retirement. Do not recreate Convex deploy jobs.

Changed paths: `.github/workflows/apply-consolidation-fix-v2.yml`.

### agent1/restrict-automation-telemetry

Head `88e679b1d7e0bfcf385a53bbf9ab3a69b386ed8b`; 5 ahead / 2135 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/agent-automation-telemetry.yml`, `convex/agentAutomation.ts`, `package.json`, `scripts/verify-agent-automation-telemetry.mjs`.

### agent1/security-bind-update-admin-pin-r1

Head `5991174933d765fee9a5b8138eaa38014900d7b5`; 2 ahead / 2077 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/auth.ts`.

### agent1/security-connected-accounts-boundary

Head `0a04da858b093bb1724e18a3bcc3bfd08babb7ba`; 2 ahead / 2084 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `package.json`, `scripts/verify-connected-account-boundary.mjs`.

### agent1/security-connected-accounts-implementation

Head `0df2996eb38e120f8da22286141a42367e22bcee`; 3 ahead / 2084 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/connectedAccounts.ts`, `package.json`, `scripts/verify-connected-account-boundary.mjs`.

### agent1/security-payout-read-boundary-guard-r1

Head `ce0ad630ad961b47db0ee0154e000a1b77d43241`; 1 ahead / 2077 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `scripts/verify-payout-read-boundary.mjs`.

### agent1/security-remove-admin-pin-fallback

Head `9935306e4078c726b40647a34b140429d5125631`; 3 ahead / 2041 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/admin-auth-boundary.yml`, `convex/adminUsers.ts`, `convex/auth.ts`, `convex/schema.ts`, `convex/security.ts`, `package.json`, `scripts/verify-admin-auth-boundary.mjs`, `src/types/three-runtime.d.ts`.

### dependabot/npm_and_yarn/npm_and_yarn-b627ae9b1d

Head `d17ee63f4989671b4d880eea7edc0ba448c68db8`; 1 ahead / 2052 behind at review.

Updates retired fundforge manifest and former root Convex dependency graph. Do not resurrect removed dependencies; main root uses Supabase and React Router 7.18.5, newer than legacy router 6.30.5.

Changed paths: `fundforge/package-lock.json`, `fundforge/package.json`, `package-lock.json`, `package.json`.

### docs/canonical-repository-architecture

Head `ee1900068057a3336321e94fa6adf171f51cb5e3`; 1 ahead / 2183 behind at review.

Old documents explicitly designate Convex as canonical and Base44 as user-facing authority; this conflicts with current AGENTS.md and 2026-11-03 architecture contract. Keep history only.

Changed paths: `docs/CANONICAL_REPOSITORY_ARCHITECTURE.md`.

### docs/canonical-source-of-truth

Head `adf8ca9d16b21fe359da62a6c9b1f84738a667e1`; 1 ahead / 2155 behind at review.

Old documents explicitly designate Convex as canonical and Base44 as user-facing authority; this conflicts with current AGENTS.md and 2026-11-03 architecture contract. Keep history only.

Changed paths: `docs/CANONICAL_SOURCE_OF_TRUTH.md`.

### docs/integration-merge-status-20261025

Head `31a3195e291e372a6e8ada46c782dcdaa5509190`; 2 ahead / 1866 behind at review.

Adds dated 2026-10-25 blockers/status facts and merge advice about then-current PRs. Keep historical commits but do not append stale live-state assertions to current operational ledger.

Changed paths: `docs/migration/BLOCKERS.md`, `docs/migration/STATUS.md`.

### docs/owner-actions-secrets

Head `210db0ca5da94526379dd8efddc69eb68a114239`; 2 ahead / 1965 behind at review.

Adds historical owner setup/Infisical/GitHub organization instructions, outdated unverified webhook status and actions on old PRs. Current contracts already preserve secret boundaries; do not revive old account changes as required current work.

Changed paths: `docs/migration/OWNER_ACTIONS.md`.

### fix/convex-native-cdp-126

Head `ccaaebe6a774c18aa8690df21f1f700c7f7b7921`; 3 ahead / 1992 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/exact-head-validation.yml`, `convex/outreachBrowserPublisher.ts`, `scripts/verify-outreach-invariants.mjs`.

### fix/outreach-agents-126

Head `7f6c2705588c930fb06d2f390e04913e8bba01e6`; 31 ahead / 1993 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.env.example`, `.github/workflows/exact-head-validation.yml`, `convex/_generated/api.d.ts`, `convex/antiSpam.ts`, `convex/campaignDefaults.ts`, `convex/campaigns.ts`, `convex/crons.ts`, `convex/http.ts`, `convex/outreachBrowserPublisher.ts`, `convex/outreachControl.ts`, `convex/protocol.ts`, `convex/protocolAutoFix.ts`, `convex/userManagement.ts`, `docs/CAMPAIGN_PROTOCOL.md`, `scripts/verify-outreach-invariants.mjs`, `src/components/UserManagement.tsx`.

### ops/serialize-convex-deploys

Head `86f781a2645f5f243828b3b76de8904c0e373bf6`; 5 ahead / 2151 behind at review.

Removes or limits mutation/deployment in retired workflows/scripts. Their target workflows/scripts are absent on main; desired no-self-mutation boundary is satisfied by retirement. Do not recreate Convex deploy jobs.

Changed paths: `.github/workflows/convex-deploy.yml`, `.github/workflows/enhanced-agent.yml`, `.gitignore`, `agent-report.json`, `scripts/enhanced-agent.mjs`.

### solstice/admin-session-integration-auth

Head `ac77b1600787b188aa4f82942aa006fd46c28bb8`; 15 ahead / 2037 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `convex/adminSession.ts`, `convex/adminTreasury.ts`, `convex/adminUsers.ts`, `convex/agentAutomation.ts`, `convex/agents.ts`, `convex/campaigns.ts`, `convex/fraudControl.ts`, `convex/security.ts`, `convex/userManagement.ts`, `src/App.tsx`, `src/components/FraudControl.tsx`, `src/components/PermissionsManager.tsx`, `src/components/UserManagement.tsx`, `src/pages/Agents.tsx`, `src/pages/Dashboard.tsx`.

### solstice/p0-current-main-financial-security

Head `da7bb7903487333ccdddf990f899bb2fb0f4be2c`; 22 ahead / 1991 behind at review.

All implementation hunks target the retired Convex/TypeScript frontend, or add verifiers/workflows coupled to those deleted sources. Preserve canonical main instead of restoring.

Changed paths: `.github/workflows/convex-deploy.yml`, `.github/workflows/exact-head-validation.yml`, `convex/_generated/api.d.ts`, `convex/agentAutomation.ts`, `convex/agentOps.ts`, `convex/automationCoordinator.ts`, `convex/automationLease.ts`, `convex/automationProvisioning.ts`, `convex/autonomous.ts`, `convex/browserbase.ts`, `convex/crons.ts`, `convex/facebook.ts`, `convex/fundConsolidation.ts`, `convex/imageGen.ts`, `convex/postContent.ts`, `convex/protocol.ts`, `convex/protocolAutoFix.ts`, `convex/research.ts`, `docs/IMPLEMENTATION_IN_PROGRESS.md`, `docs/P0_ACTIVE_WORK_NOTE.md`, `docs/P0_DO_NOT_MERGE_STALE.md`, `docs/P0_IMPLEMENTATION_STATE.md`, `docs/P0_NEXT_ATOMIC_COMMIT.md`, `docs/P0_NO_STALE_OVERWRITE.md`, `docs/P0_RECONCILIATION_PLAN.md`, `docs/P0_RELEASE_CRITERIA.md`, `docs/P0_SOURCE_LINEAGE.md`, `package.json`, `scripts/verify-automation-provisioning.mjs`, `scripts/verify-automation-serialization.mjs`.

### vercel-agent/fix-globe-init-error

Head `b519a2a395bc38393eb18f7a317aca020e54ced3`; 2 ahead / 1990 behind at review.

Changes deleted src/pages/Globe.tsx and obsolete Three.js lifecycle. Canonical Atlas uses current atlas/CampaignGlobe and explicit loading/error/retry handling; old patch also references handler constants outside their lexical scope in cleanup.

Changed paths: `src/pages/Globe.tsx`.
