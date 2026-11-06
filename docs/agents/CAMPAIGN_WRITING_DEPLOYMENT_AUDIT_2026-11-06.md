# Auditor 3 — campaign writing service preview audit

Recorded 2026-11-05 12:10:44 UTC. **PASS within the bounded deployment,
authorization, artifact and public-render scope below.** No authenticated task,
model inference, live campaign save/publication, configuration or schema change
was performed. No tracked file was changed by this auditor.

## Deployment identity

- PR #222: `feature/campaign-writing-service-20261105`, head
  `f866164a23c111cf92ad561ac2c3e4d6efb31d1f`, base `main`.
- Cloudflare Pages project `interplanetaryfund-migration`, preview deployment
  `d6757727-21ec-47b7-8e61-7bdb40aeff4a`, successful deploy at
  `2026-11-05T12:05:40.344614Z`.
- Actual audited URL:
  `https://d6757727.interplanetaryfund-migration.pages.dev`.
- Both latest-head GitHub workflows succeeded: frontend run `42024101322` and
  release-candidate run `42024101202`. Skipped CodeRabbit/Supabase integration
  checks were not represented as passes.
- Production remains Pages `92822be7-2340-4d76-a554-19d197bafb3a`, source
  `721a7902ef0f6203273863ed9967b4f614694155`, successful deployment.
  Automatic production deployment remains false. Production Pages still binds
  only `IFUND_STORY_AGENT` to `ifund-story-agent`.
- Independent read-only Worker settings confirm the production
  `IFUND_WORKFORCE_ENABLED` flag remains absent and its Supabase URL is canonical.
  This auditor did not change or independently re-query the database control.

## Hosted authorization checks — PASS

All responses were actual TLS-verified responses from the exact preview URL.
The invalid-token POST used a synthetic valid input envelope but an invalid
Bearer token; it did not pass authorization or reach model execution.

| Route | Method / caller | Observed |
| --- | --- | --- |
| `/api/services/story_agent/campaign-preview` | GET / anonymous | JSON 405 |
| `/api/services/story_agent/campaign-preview` | POST / anonymous | JSON 401 |
| `/api/services/story_agent/campaign-preview` | POST / invalid JWT | JSON 403 |
| `/api/services` | GET / anonymous, invalid JWT | JSON 401, 403 |
| `/api/services/status` | GET / anonymous | JSON 401 |
| `/api/services/admin_builder_agent/drafts` | GET / anonymous | JSON 404 |
| `/api/services/story_agent/drafts` | GET / anonymous | JSON 401 |
| `/api/services/story_agent/queued-requests` | GET / anonymous | JSON 401 |
| `/api/services/story_agent/subscription` | GET / anonymous | JSON 401 |
| `/api/agents/story/subscription` | GET / anonymous, invalid JWT | JSON 401, 403 |

These checks demonstrate route registration and negative authorization behavior;
they do not demonstrate signed-in assistance, procurement, ownership or recovery.

## Deployed artifacts — PASS

| Asset | SHA-256 |
| --- | --- |
| `/assets/index-Dcp9Eylq.js` | `bbcf18e7f2b266511dd1e66a167b32e06665e6f93bfc208983785553a2ba643a` |
| `/assets/CreateCampaign-BybHcABH.js` | `ac8c2f2dc459f4be2ed34b1ee28ea076c58aed6550109948d155d43b9fb74c39` |
| `/assets/StoryAgent-CgQD_Zog.js` | `614ac75b22c686263f22ae429de5b185b58f9b2d0effbf8962ee0d6023201a42` |
| `/assets/ownerCampaigns-C9z-kGM_.js` | `32ea63e146123e38b897f4c7bcca23bced870d5e21bb18a6f4f6fbc9daa59780` |

- Actual creator code uses the permanent
  `/api/services/story_agent/campaign-preview` address. The old Supabase helper
  name, inspected provider/model identifiers and provider API address are absent
  from that chunk.
- Basic outline and assisted-result metadata/labels are present. Source and
  transport inspection distinguish a non-inference outline from assisted
  suggestions and retain queued/error handling rather than inventing success.
- Explicit Publish campaign and Save private draft, expected draft state,
  identity-scoped browser storage and owner transport legal-acceptance checks
  remain present. These static observations are separate from live owner writes.
- The four inspected artifacts contain no complete modern server-secret marker
  or server-secret environment-variable marker. This is a bounded scan, not a
  claim about all external assets or backend credentials.

## Public/mobile rendering — PASS with explicit transport limitation

Chromium at 390×844 consumed actual deployment responses through a Playwright
APIRequestContext using the enforced `http://proxy:8080` proxy, existing CA trust
and `ignoreHTTPSErrors:false`. Responses were fulfilled into the renderer; no
frontend or data response was mocked. All non-read requests were blocked by the
auditor's route rule; none were attempted in this run.

- `/create`, `/agents`, `/campaigns` and `/login` returned 200 and rendered expected
  public/member-gated content, with zero JavaScript errors, failed reads or
  horizontal overflow.
- Guest creator retains all **five writing choices**, **11 categories**, Before
  you publish and the sign-in boundary. Publication controls remain in the
  deployed component behind member access.
- A synthetic browser-only guest title and animal category survived reload in a
  version-2 record with `owner_id:null`. No database campaign was created.
- Creator also showed no horizontal overflow at 1280×900.
- An initial harness shutdown disposed two pending third-party font fetches.
  After waiting for font/network completion and draining route handlers, the
  complete audit passed with zero failed reads. This was a harness lifecycle
  correction, not a demonstrated application defect.

Raw bounded evidence is in `work/campaign-writing-hosted-audit.json`; the audit
harness is `work/audit-writing-hosted.mjs`.

## Limits and release boundary

**NOT TESTED:** direct hosted Chromium networking (environment proxy CA trust
limitation), real signed-in campaign creation/publication, hosted assisted
generation, queue recovery/reassignment, account switching, provider receipt or
production procurement. The previously recorded 15 local browser scenarios and
23 Reviewer 2 checks remain distinct evidence.

No blocking issue was found in this bounded preview audit. A Pages-only bridge
promotion must still be followed by actual production source/artifact/route
verification. No Story Worker binding/flag, database control, payment, DNS/mail,
provider, plan or storage change is required by this component. Full specialist,
shared-knowledge and outcome-learning parity is not declared complete.

## Production follow-up — PASS within the bounded scope

Recorded November 5 Pacific / `2026-11-06T02:25:34.301Z`.
This follow-up independently checked current Cloudflare metadata, the real
production domain, authorization failures, deployed artifacts and public/mobile
rendering. No authenticated task, model inference, database campaign write,
checkout/payment interaction, setting change or deployment was performed.

### Historical writing release and current production

- The writing release did successfully deploy: Pages
  `da71bc17-318c-4bd9-8125-0dbee1375691`, source
  `15b987f165217eabca21d1abba12a93018d06a0e`, completed
  `2026-11-05T12:13:41.038908Z`. This was independently read from its immutable
  deployment record; it is no longer the current canonical deployment.
- Current canonical production is Pages
  `8296ae39-8a48-4b9a-a139-cd3dcec661b1`, source
  `ed39a2e6cc6273c4bd7660dd3058299fadd0cad5`, completed
  `2026-11-05T15:50:30.18639Z`. Real-domain checks used
  `https://interplanetaryfund.com`.
- `15b987f` is an ancestor of current `origin/main`. The subsequent diff affects
  only `apps/web/src/App.jsx`, `apps/web/src/components/Layout.jsx` and
  `apps/web/src/components/payments/PlatformSupportHostedButton.jsx`.
  Those later platform-support changes were preserved and not changed or
  functionally reviewed as part of the writing audit.
- Automatic production deployment is now **true**, unlike the earlier preview
  record. This was observed, not modified. The audit does not infer who changed
  it or restore the historical setting.
- Production Pages still binds only
  `IFUND_STORY_AGENT → ifund-story-agent`. Independent Worker settings confirm
  `IFUND_WORKFORCE_ENABLED` is still absent and `SUPABASE_URL` still points to
  canonical `ssibsfmtodgximseeqsv`. Secret values were neither printed nor used.
- Builder 1 separately reports a current read-only database control check:
  production procurement **false**, preview procurement **false**, assignments
  **zero**. This auditor did not independently re-query those database values.
  Earlier preview-enabled observations are historical and must not be treated
  as the current control state. Nothing was re-enabled by this audit.

### Actual production authorization — PASS

All 12 checks in the preview table above were repeated against the real
production domain and passed with the same expected JSON statuses. In
particular, campaign-preview GET returned 405, anonymous POST returned 401,
invalid-token POST returned 403, permanent and legacy Story access remained
denied to unauthenticated callers, and the private builder returned 404.
The invalid-token input envelope was synthetic and did not pass authorization.
These negative checks do not demonstrate successful authenticated execution.

### Current deployed artifacts — PASS

Later frontend imports change the compiled asset hashes; the current files are
recorded explicitly rather than represented as byte-identical to the preview.

| Asset | SHA-256 |
| --- | --- |
| `/assets/index-BU6VqpSu.js` | `323587a1e65a6e10e8d70e87a03b5983b60ec77780681fb4f65824f95e092434` |
| `/assets/CreateCampaign-Chlxmgt6.js` | `1f7a43e52c6431abe54a9551b99da91a972123f883eca1ff8abe49958a90996d` |
| `/assets/StoryAgent-Dz42ujIK.js` | `c4c6c248aa5c3526ea597444bf34ef7cee97104bf5d613b911ab2e8e088a0cd4` |
| `/assets/ownerCampaigns-giCLTC-H.js` | `0794569626c665bb6ab5024bafc3a11a05e4c088b7f6604da6ca575309122c2c` |

- Creator uses `/api/services/story_agent/campaign-preview`; Story uses its
  permanent service prefix. The old Supabase helper name is absent from these
  inspected chunks.
- Creator preserves basic-outline/assisted-result metadata, queued handling,
  previous-suggestion messaging, current-session checks, stable retry response
  handling, `writing_brief`, version-2 owner attribution and expected draft
  status. Publication and private-save controls remain present. These are
  compiled-code observations, not live signed-in execution claims.
- No inspected chunk contains a complete modern server-secret credential or
  server-secret environment-variable marker. This remains a bounded scan.

### Current real-response mobile/public audit — PASS

The reused harness completed with exit code 0. It retained certificate
verification (`ignoreHTTPSErrors:false`) and the enforced proxy, fetched actual
responses through Playwright APIRequestContext, and fulfilled those into
Chromium. It did not mock frontend/data responses or bypass TLS.

- `/create`, `/agents`, `/campaigns` and `/login` each returned 200 and rendered
  expected content at 390×844. No JavaScript page error, failed read or horizontal
  overflow was observed.
- Creator retains five writing choices, 11 categories, Before you publish and
  the guest sign-in boundary. A synthetic browser-only guest title and animal
  category survived reload in a version-2 record with `owner_id:null`.
- Creator also showed no horizontal overflow at 1280×900.
- The read-only route rule blocked only Cloudflare RUM beacon POSTs. No checkout,
  account, campaign, task or inference action was attempted. The later PayPal
  support presentation was not clicked or tested for payment behavior.

Raw evidence: `work/campaign-writing-production-hosted-audit.json`,
`work/campaign-writing-production-hosted-audit.log`,
`work/campaign-writing-production-markers.json`; harness:
`work/audit-writing-production-hosted.mjs`.

**NOT TESTED:** direct hosted Chromium networking, real signed-in assisted
generation/publication, cross-owner runtime, queue recovery/reassignment,
provider receipt, and the full collective intelligence network. Procurement
activation is not established. No blocking defect was found within this
production follow-up's public-render and authorization scope.
