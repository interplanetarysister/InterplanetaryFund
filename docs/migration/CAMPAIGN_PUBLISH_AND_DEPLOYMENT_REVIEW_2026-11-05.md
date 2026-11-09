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
- Unsaved new campaigns and assistant context are also reset on account change
  or sign-out. A scoped browser record allows guest→first-owner handoff and
  same-owner restoration; it never restores an attributed draft for another
  identity. Old unscoped preview text is retained separately for recovery and
  is not automatically displayed to an unverified owner.
- The creator requires the stored state to remain `draft`. A concurrent publish
  or pause blocks the stale write. Failed requests preserve the current text;
  receipt ownership and requested status are checked before success/navigation.
- Donation, PayPal, subscription, withdrawal and ledger behavior is unchanged.
  Publishing a public campaign does not activate campaign donations.

## Verification ledger

- Reviewer 2 independently reviewed the diff: no blocking security finding;
  requested saved-state notice correction applied after confirmed owner load.
- Web: all 27 test files passed; owner transport 27/27 cases and browser-draft
  isolation 4/4 cases passed. Shared
  validation covers incomplete content, invalid/nonfinite goals and field limits.
- Root: all 30 test files passed. Canonical web production build and root build
  passed; `git diff --check` passed. No dependency/lockfile change was required.
- Chromium, 390×844, local app with intercepted Supabase transport: **9/9 PASS**:
  Enter saves privately; same draft publishes once and reloads in public/Discover;
  direct publish inserts once; failure preserves text; stale state blocks before
  writing; guest text survives login without automatic publishing; consent is
  required outside the campaign form; other-owner draft access and suspended
  account editor access are denied; an SDK account switch and sign-out clear
  unsaved member form text and assistant context. No uncaught script errors or horizontal
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

- First fixed preview: `8f12b2ff-f741-4080-a6b9-ec0ab745e407`, commit `01e8dc6`,
  successful deployment at `https://8f12b2ff.interplanetaryfund-migration.pages.dev`.
  Auditor 3 confirmed explicit publishing code, five choices, eleven categories,
  seven clean mobile route renders and no server credentials in relevant chunks.
  This preview is **superseded** by the additional account-isolation correction.
- GitHub release-candidate checks on `01e8dc6` passed:
  [run 41976633959](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41976633959).
- Replacement preview: **PASS**, deployment
  `d53211ab-7f2b-4761-89d3-b810e01d7aac`, source
  `755183795d91417adb8c8c941b82f17cd9680933`, URL
  `https://d53211ab.interplanetaryfund-migration.pages.dev`.
  Auditor 3 confirmed compiled ownership guards, seven clean mobile route
  renders, desktop layout, all five writing choices/eleven categories, guest
  edit→reload→sign-in return→back persistence, public campaign rendering and
  authentication denials. No service writes or inference were performed.
  Builder separately verified the deployed main asset SHA-256
  `ab5029052ec7fa841e083bf89145c1f416bdf6a9aaf1c9d75f7546d89ec22783`,
  explicit publish action, scoped draft storage and expected draft state.
- Reviewer 2 rechecked the privacy correction: no remaining blocker; the
  legacy archive write runs during persistence, not the render initializer.
- PR #219 merged into the existing release branch, then PR #218 merged into
  main as `69cb1e1aa338d3a1cd71bc34552089422a18359e`. Release-head frontend
  [CI 41977970608](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41977970608)
  and [release checks 41977970554](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41977970554)
  passed. Release preview `2cf3b0b9-411d-47ff-b627-536cfc2417e6` at source
  `424e851` served identical reviewed app assets. Main and release trees match
  exactly (`c1330cb684a451f803728d903753fd186062eb62`).
- **Production deployed and audited:** `e80eaf9a-6f4e-459b-8bec-71bfffa1bd14`,
  source `69cb1e1`, completed successfully November 5 at 06:07:45 UTC.
  `https://interplanetaryfund.com/create`, its immutable Pages deployment and
  the current custom preview domain serve reviewed main asset
  `index-CEEM4Y6A.js`, SHA-256
  `ab5029052ec7fa841e083bf89145c1f416bdf6a9aaf1c9d75f7546d89ec22783`.
  Builder verified real HTTP responses independently; Auditor 3 rechecked four
  mobile routes/public campaign rendering without errors or overflow, five
  writing choices/eleven categories, Story anonymous 401 and invalid-token 403.
  Campaign donation button remains disabled. No signed-in owner mutation was
  performed or claimed by these deployed checks.
- Production still binds only the existing production Story Worker; automatic
  production deployment remains false. No DNS/mail, payment, workforce
  activation or billing setting changed. `preview.interplanetaryfund.com` still
  points to production rather than the isolated branch preview. Rollback target
  remains `8b0e1e4a`.
- After fixed preview review, reconcile the release and production source refs,
  preserve PR #212's separate workforce implementation, and continue the existing
  sequential agent ledger. Multi-specialist execution, authorized shared learning
  and verified campaign outcome learning remain incomplete.

## Four-step campaign parity increment — November 8, 2026 Pacific

Scope: issue #137, `apps/web` only, based on live-repository main `db48d31`.
Read-only reference: `interplanetary-fund2` source at `52477ea6` and current
remote main `f27c7f31` (creator delta adds guest gating; no reference edits).
This is a scoped builder adaptation, not a declaration of full Base44 parity.
No deployment, provider activation, schema migration or campaign data change is
part of this increment.

### Feature-by-feature checklist and implementation decisions

`Adapted` means implemented locally; verification results are recorded below.
`Gap` means explicitly unavailable, not a working replacement.

| Reference feature / source | Previous live behavior | Decision / status |
|---|---|---|
| `CreateCampaign`: Your Details, Basics, Your Story, Launch | One long assistant/form page | Adapted: four steps, matching labels, icon/check progress, headings, Back/Continue and explicit review |
| Deep-space container, glass panel, cyan/violet controls, mobile spacing | Creator did not use existing quest styles | Adapted: reuse the already-portable `index.css` classes, brand image and native accessible controls |
| `AIInstructionsStep`: optional goal/beneficiary clues | Five writing paths, details/beneficiary/need | Adapted using existing brief and five working paths; Details is skippable |
| Permanent AI profile: tone, donor-discovery mode/notes, exact facts, emphasis, avoided words, outcome, platforms | No profile in canonical campaign read/write contract | Gap: additive private profile storage and validated context adapter needed; no donor research, outreach or sharing is implied by a text brief |
| Category and goal | Eleven canonical categories, USD validation | Preserved in Basics; require valid positive goal to Continue and explain invalid precision/values |
| Deadline | No canonical column/payload | Gap: additive `end_date`, API limits and owner grants; display unavailable, no unsaved date input |
| City lookup and location coordinates | No canonical columns/payload in creator | Gap: verified independent `geocodeCity` replacement and location schema/grants; do not revive Base44 function calls |
| Crypto donation preference | No canonical preference/settlement contract | Gap: private preference field plus separately verified settlement integration; no wallet or accepting-coins claim |
| `CampaignCopyChoices`: editable title/description and individually generated options | Existing service returns five titles and two summaries together | Adapted: reuse `campaignDraft.js`, retain explicit apply/edit actions; five descriptions and title-conditioned separate regeneration remain a service-contract gap |
| `AIStoryGenerator`: draft and section rewrites | Existing reviewed proposals, explicit accept/discard and apply | Preserved inside Your Story; never auto-apply generated text |
| Story tones/length, version history (up to 50), restore | Existing section proposal editing only | Gap: persisted owner-scoped history and validated story-revision contract needed; no cross-device restore claim |
| Final editable story | Existing bounded textarea | Preserved as authoritative saved field; all suggestions require explicit application |
| Image URL / optional default cover | URL field and public fallback image | Adapted: cover preview in story and launch using existing `Image` and `FALLBACK_IMAGE` |
| Generate cover (`generateCampaignCover`, provider, branding/upload) | Writing returns image prompt only | Gap: secure independent image generation, validated storage upload and AI provenance; prompt is labeled as a concept, not a generated image |
| `MediaUpload` | No working creator upload service | Gap: scoped Storage bucket/path, file/type/size checks, policies and upload adapter; retain working URL input |
| Voice / Alexa+ simulation | No creator voice adapter | Gap: browser speech/simulation adapter and accessible fallback; any provider-backed speech needs a verified service. It must call the same save service and require confirmation |
| Connected-fundraiser import | No creator import service | Gap: owner-verified connection read/import adapter with provenance, private draft and idempotency; never treat external totals as ledger money |
| Save at every step | Server drafts require title | Preserve safeguard: Save private draft at all steps; explain title requirement and provide title-edit shortcut. Browser session retains unsaved new content |
| `draft_step` resume | No canonical field | Adapted session-only resume scoped by owner and exact campaign; cross-device resume needs schema/API extension |
| Brief survives first save / login return | Guest brief persisted; first saved-route remount lost it | Adapted: pass current step/brief to exact saved campaign in allowlisted session storage; no tokens or arbitrary fields |
| Full launch review | Readiness list beside form | Adapted: cover, category, title, summary, goal and full story; Edit your story, readiness list, explicit publish only on Launch |
| Reference allows summary fallback and story-or-summary | Live DB requires title + summary + story + positive goal | Deliberately retain stricter live validation; no schema relaxation or silent summary derivation |
| Guest exploration then account save/launch | Existing scoped guest-to-first-owner recovery and safe return URL | Preserved; never auto-publish after login or agreement acceptance |
| Auth, private drafts, account isolation | Existing confirmed user, active account, current terms, owner-scoped reads/writes, session recheck | Preserve `MemberAccess`, `useAuthSession`, `ownerCampaigns.js`; reset composer and suggestions on owner or draft change |
| Stale-state and duplicate publishing | Existing draft-only compare-and-swap and immediate locks | Preserved unchanged in owner API; publish receipt still confirmed before navigation |
| `recordCampaignCreated` side effects | Not part of live creator | Gap: verified event/audit and idempotent workflow adapter; not silently invoked or simulated |
| Donations/payment enablement | Existing creator says donations paused | Preserved. Publishing is visibility only; no payment activation |

Supporting campaign components outside creation (donations, funding, follow,
updates, translations, outreach, embeds, sharing, settings and campaign tabs)
remain owned by their existing flows. This increment does not replace their
services or claim their Base44 behavior has been verified.

### Sequenced implementation plan

1. Inspect required sources, architecture contract, inventories, current GitHub
   main/open PRs and hosted environment/catalog. Identify safe testing boundary.
2. Reuse the existing composer and all working owner/writing services. Add the
   four-step shell and move controls into the reference sequence without a
   second campaign API or frontend implementation.
3. Add full review and optional cover preview. Keep all publish validation and
   member gating. Preserve implicit form submission as private save.
4. Add allowlisted session-only UI progress, bound to both identity and campaign,
   to retain brief/step over first save and reload without schema changes.
5. Update the existing browser regression harness for real step navigation;
   intercept every external request, block unhandled local APIs/service workers,
   and use a dummy browser key. Exercise positive/negative publishing, recovery,
   queued/failed writing and isolation. Capture mobile/desktop screenshots.
6. Independently review security and parity. Run web tests/build and record
   explicit gaps. Review a future preview with side effects disabled before
   requesting any real owner save/publish or deployment.

Backend follow-up order: reconcile the actual catalog first; define bounded
private profile/step/version fields and owner-only grants; add media adapters;
then location/import/voice and separately authorized providers. Check for
existing ported services/open PRs before creating any replacements. Prove each
adapter against an isolated database before activation. No pending migration is
applied wholesale.

### Current environment and catalog verification

Read-only connected Cloudflare Pages project GET on November 9 UTC confirms
`interplanetaryfund-migration`, production branch `main`. **Both preview and
production `VITE_SUPABASE_URL` are still
`https://ssibsfmtodgximseeqsv.supabase.co`.** Preview Story/Strategy/Growth/
Communications/Connections service names differ from production, but that does
not isolate campaign storage. Latest preview observed: `4ac41e91-150b-4797-9f12-d1323789a99d`,
source `e4dd18e27d04f3871934af4e4f8bf0de94a25dc8` on another feature branch;
no settings were changed. Direct public HTML probes were denied HTTP 403 in this
environment, so no current public-bundle equivalence is asserted.

Read-only Supabase catalog/migration-history queries confirm canonical
`public.ifund_campaigns` has only id, owner_id, title, summary, story, category,
goal_amount, cover_image_url, status, created_at and updated_at. None of the
additional Base44 creator fields above exists there. RLS is enabled; insert and
update check auth ownership, active account and current terms; owner_id is not
client-updatable. Publish completeness remains enforced by
`ifund_publish_complete`. Current database status check also includes `completed`,
while the creator intentionally retains its existing draft/active/paused API
contract. Current authenticated UPDATE policy only permits resulting draft/active;
this pre-existing pause-policy mismatch is outside this UI change. Current anon
SELECT grants include owner_id, unlike the historical private-column denial
record above; reconciling public-column privacy needs its own catalog review and
is not silently changed by this increment. No customer rows were queried.

Testing policy: **no remote saves, publishes, uploads, queued AI requests or
rollback-based synthetic writes**. Mocked local transport only. Live Auth JWT
save/publish and full RLS mutation tests remain NOT TESTED and require an
isolated environment or the owner's explicit approval.
