# iFund coordination: unowned or under-executed work register (2026-11-15 02:50 PT)

**Authority and priority:** canonical `interplanetaryfund.com` / `interplanetarysister/InterplanetaryFund`, website and admin first. Base44 remains read-only. No automatic build/deployment, payments, payouts, live finance SQL, DNS or extra branches. This register is *not* release acceptance.

## Verified baseline

- GitHub `main`: `b473f7021193aec85a9a359bab37f940162a49f4`. Source route branch `feature/route-completion-20261113`: 318 commits ahead / zero behind on coordinator recheck; finance `preview/source-staged-20261113`: 36 ahead / zero behind. Recheck each run because owners commit concurrently.
- Route ledger: 82 tracked, 79 `not_verified`, 3 `source_ready`, 0 browser-certified in latest independent QA. Seven of eight admin patterns unverified. An existing React route or source-only test is not proof of an operating endpoint.
- LIVE Cloudflare project `interplanetaryfund-migration`: `main` production branch; `deployments_enabled=false`, `production_deployments_enabled=false`. Latest *successful production Pages deployment* `b73f6aa2-1203-497e-a832-8f9ddaf19393` at `a92f684596e8e5e90041e4d0cc1f2022956d15ab` (2026-11-13). Current GitHub `main` contains **202 newer commits touching 100 files**; verified by comparison. Latest *preview* is `a1e8880d-0dca-424a-81d1-4133b6218d35` at `a7fb261a12550bb712f8175f70b6d892d1b95a97` from old Connections branch, not a route-release candidate.
- Shared team context is source-staged only and `IFUND_TEAM_CONTEXT_ENABLED` remains off. Mobile bundles native assets and is unsigned/unverified; no store release.
- Active hourly owners A1 Frontend, A2 Backend, A3 Finance/Connections, A4 QA and A5 Coordinator remain in place. Existing issue #203 is the cross-team inbox.

## Actively owned work — do not duplicate

| Owner | Current already-assigned primary task | Missing acceptance |
| --- | --- | --- |
| A1 | Guest draft privacy/consent, publication receipts, help/admin UX, mobile/member account-switch | Executed Node/mounted browser identity tests and 320/390px screens |
| A2 | Owner RLS, admin Help/audit RPCs, shared-event correction/replay SQL, atomic subscription refund parent/ceiling and status ordering | Disposable two-pass PostgreSQL + cross-owner negative tests and signed function contract |
| A3 | Payment quote/readiness guards, signed PayPal provider Edge, Connections and permission validation | A2 atomic SQL acceptance, signed Edge/provider negative fixtures, role/ledger/idempotency |
| A4 | Route/browser/role/security/native acceptance; one immutable release candidate and controlled preview-first release | Runnable checkout or lawful alternate test harness; independent artifact, applied migration and rollback provenance |

## Newly elevated work packages, with one accountable owner

1. **P0 — deployed artifact / source / live schema delta** (**A4 lead**, A2/A3 evidence): produce a three-way matrix `production deployed SHA a92f684` versus `main b473f702` versus a selected tested staging SHA, with per-path frontend/API/Worker and migration dependency. Verify status of live Workers independently. Do not claim any of the 202 newer commits are deployed. Capture immutable rollback artifact identifiers; ensure no auto-deploy.
2. **P0 — executable QA escape from DNS block** (**A4 lead**): GitHub connector can fetch individual committed source files even when `git clone` DNS fails. Prioritize pure module execution from **exact fetched blobs** in bounded evaluator with clearly labeled scope; consider provider-approved archive transfer or attached export for full Node/React/PG/browser environment. Do not mistake static regex/source evaluation for full runtime tests. Execute current draft, Unicode router, payment quote, synthetic refund and readiness tests as feasible; report cases and source SHA.
3. **P0 — admin route runtime closure as one explicit matrix** (**A1 UI**, **A2 backend**, **A4 certifier**, A3 integrations only): `/admin/audit`, `/admin/help`, `/admin/finance`, `/admin/studio`, `/admin/social-moderation`, `/admin/sustainability`, `/admin/integrations`, and `/admin/*`. A2 already reports audit/read-receipt/editorial functions applied; no complete browser JWT/RLS role matrix. A1 owns missing/failed UI states, A4 tests signed-out/member/admin/super-admin/other-owner.
4. **P1 — shared real-specialist context coverage** (**A2 backend**, **A1 UI**, **A4 acceptance**): reconcile legacy `ifund_agent_conversation_run` ownership without broad backfill, integrate other genuine user-facing specialist services into one verified owner history, ensure correction/erase and retention reach across reads, audit credentials redaction. Keep feature flag off until signed Worker origin, PostgreSQL grants and two-user replay tests.
5. **P1 — partner-first attribution and permission provenance** (**A3 provider/financial truth**, **A2 owner storage**, **A1 presentation**, **A4 test**): explicit source labels for clicks vs verified partner gifts vs owner reports vs sandbox; ensure external host checkout is a direct handoff with **no 7% deduction**. Permission controls centralized on Profile and signup, with missing provider authorization clearly unavailable. This is not a license to invent OAuth grants or partnership status.
6. **P2 — native signing/domain/OAuth/Apple+Play acceptance** (**A4 gate**, A1 native UX, A2 native auth, A3 payment policy): signed associated domains, OAuth/email callback on device, checkout entitlement and financial policy, signed IPA/AAB with developer credentials. Defer release until working canonical web/admin paths; preserve Base44 APK.
7. **P2 — evidence-grounded design polish** (**A1**): nature-integrated Cosmic Geometry, keyboard/contrast, mobile sidebar and campaign readiness, Atlas geographic evidence. Complete route behavior before visual polish.

## Gating dependency order

A1/A2 admin and public/member routes + A4 authenticated/negative acceptance; in parallel A2 atomic SQL -> A4 disposable PG -> A3 exact signed provider Edge caller -> A4 provider negatives. Reconcile evidence-backed source to main -> one immutable preview artifact -> full preview/browser/role/financial acceptance -> **separately owner-authorized** production promotion. No autonomous deployment for these tasks.

## NEXUS coordination proof

`docs/agents/NEXUS_WEEK46_COORDINATOR_EVIDENCE_20261115.md` at commit `ae1d3d517dc39ad3996c2fcad1e28a217fc0ba21`: 8/8 isolated tests of actual versioned routing module passed, including mixed ORBIT/STORY/FORGE/PULSE and LINK/DISCOVER referrals. This is an unreviewed **synthetic proposal** only; no real specialist run or cross-user communication. Weekly lesson acceptance remains pending independent review.
