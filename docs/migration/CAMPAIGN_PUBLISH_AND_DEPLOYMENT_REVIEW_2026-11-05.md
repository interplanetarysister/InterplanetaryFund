# Campaign publishing increment and deployment review

Recorded November 4, 2026 Pacific / November 5 UTC. This record supersedes the
historical zero-user / no-credential assertions in B14–B15 for the checks below.
It does not claim full platform, agent, payment or migration parity.

## Scope and source

- Reported behavior: a member saved a draft but found no publish action in the
  creator. The creator always wrote `draft`, despite existing publish actions
  in My campaigns and the editor.
- Baseline: `release/preview-integration-20261104` at
  `9a7cba3dae5d1d11fc5f50ef8cfa81a4a8792b1a`; main at `1eb40a8`.
- Increment branch: `fix/campaign-publish-20261105`. Canonical frontend:
  `apps/web`. Preserve the release branch's guided writing and guest recovery.
- Reuse `ownerCampaigns.js`, existing campaign table/RLS, member agreement and
  lifecycle validation. No new campaign API, schema, provider or paid service.

## Implemented behavior

- Explicit **Publish campaign** alongside **Save private draft**. Ordinary form
  submission saves privately. Publish readiness explains missing information;
  all eleven existing categories and canonical field limits are available.
- Publish saves the reviewed content and opens the confirmed campaign's public
  page. Saved drafts update the same record; an immediate lock prevents rapid
  duplicate submissions. No publish occurs automatically after sign-in.
- Current verified identity, active account and member agreement are required.
  Saved private drafts use the existing member gate, which clears their editor
  on identity changes. Guest writing remains available before sign-in.
- The creator requires the stored state to remain `draft`. A concurrent publish
  or pause blocks the stale write. Failed requests preserve the current text;
  receipt ownership and requested status are checked before success/navigation.
- Donation, PayPal, subscription, withdrawal and ledger behavior is unchanged.
  Publishing a public campaign does not activate campaign donations.

## Verification ledger

- Reviewer 2 independently reviewed the diff: no blocking security finding;
  requested saved-state notice correction applied after confirmed owner load.
- Web: all 26 test files passed; owner transport 27/27 cases passed. Shared
  validation covers incomplete content, invalid/nonfinite goals and field limits.
- Root: all 30 test files passed. Canonical web production build and root build
  passed; `git diff --check` passed. No dependency/lockfile change was required.
- Chromium, 390×844, local app with intercepted Supabase transport: **8/8 PASS**:
  Enter saves privately; same draft publishes once and reloads in public/Discover;
  direct publish inserts once; failure preserves text; stale state blocks before
  writing; guest text survives login without automatic publishing; consent is
  required outside the campaign form; other-owner draft access and suspended
  account editor access are denied. No uncaught script errors or horizontal
  overflow. These are UI/transport tests, not a live Auth test.
- Reproduce with the existing local Vite dev server, canonical Supabase URL and
  a dummy publishable test key. Run `scripts/verify-campaign-publishing.mjs`
  using an already-installed Playwright module via `IFUND_PLAYWRIGHT_MODULE`.
  The harness refuses nonlocal origins and downloads no browser/packages.
- Live canonical Supabase `ssibsfmtodgximseeqsv`: **8/8 permission checks PASS**
  using `scripts/verify-campaign-publish-rls.sql`. Existing verified identities
  exercise the actual `authenticated` / `anon` roles and policies, without a
  service-role bypass. Tests cover owner insert/reload/publish, incomplete-content
  rejection, cross-owner private read/update/impersonated insert denial, anonymous
  private read denial, cross-owner public edit denial, anonymous Discover visibility
  and denial of the private owner column. All synthetic writes roll back inside
  a subtransaction. **Zero test campaigns persist; no existing campaign changes.**
- Actual signed-in hosted browser save→publish using a real Auth JWT: **NOT
  TESTED** by the builder/auditor; no credentials were requested or fabricated.

## Deployment baseline independently checked by Auditor 3

- Pages `interplanetaryfund-migration`, account
  `c95db4f2c901f32776471b85f1eda15d`, correct repo/root `apps/web`, tests/build
  configured. Production automatic deployment remains disabled.
- Production: deployment `8b0e1e4a-6bc6-4f3d-b828-9cfe45f5e4ab`, commit `af3acb9`.
- Integration preview: deployment `85166f93-42cf-4634-bd75-0f3d685fdbd1`, commit
  `9a7cba3`, URL `https://85166f93.interplanetaryfund-migration.pages.dev`.
- **Domain drift:** `preview.interplanetaryfund.com` serves production's exact
  main JS asset (`bf7b05e411e4ea449eb421bdc97a6900fc910bbc725ef9dd7035b8e982a7814b`),
  not the integration preview asset (`7bd9444772c136e1fe3f6da9289d43e6d5ca25e2b0ad0b75d27ea3499eadcf59`).
  No domain/DNS/mail setting was changed by this increment.
- Public deep links and anonymous protected-API denials passed. Actual
  HTTPS-verified deployment responses rendered in Chromium at 390×844 without
  script errors/overflow. Direct Chromium networking could not trust the managed
  proxy CA; the auditor used TLS-verified APIRequestContext responses, preserved
  certificate verification and separately labeled that transport.
- Production Pages binds production Story only; preview binds isolated Story,
  Strategy and Growth Workers. Both use canonical Supabase: preview campaign data
  is not a separate database. No member's test draft is published by this work.
- The release preview does not include PR #212's permanent-service gateway.
  Production/preview feature parity and agent procurement are not interchangeable
  with this campaign publishing fix.

## Deployment and remaining work

- Fixed preview: pending verified push/deployment; update this ledger with exact
  commit, URL, CI and deployed checks before claiming live functionality.
- Production promotion: pending preview/release review. Rollback target is
  existing production deployment `8b0e1e4a`.
- After fixed preview review, reconcile the release and production source refs,
  preserve PR #212's separate workforce implementation, and continue the existing
  sequential agent ledger. Multi-specialist execution, authorized shared learning
  and verified campaign outcome learning remain incomplete.
