# Story production release

Owner-authorized production activation completed November 3, 2026 (Pacific); provider deployment timestamps are November 4 UTC.

- Source PR: https://github.com/interplanetarysister/InterplanetaryFund/pull/210 (merged).
- Tested release head: `0c551917ef1bf6fe8197d5a4bc03a9bccc997c32`.
- Production main merge: `af3acb935e577f7fd9ff021822debc5bc5f43969`.
- Pages production deployment: `8b0e1e4a-6bc6-4f3d-b828-9cfe45f5e4ab`, successful.
- Public entry: https://interplanetaryfund.com/agents . Signup: https://interplanetaryfund.com/register .
- Production Worker: `ifund-story-agent`; deployment `b0b52858d62e486c87860d2612394a23`.
- Canonical SQL migration: `20261104043420_ifund_story_preview_contracts.sql`, exact applied SQL MD5 `3dd656d10a0542b4378288ee9f181fd6`.
- Runtime and inference bindings are enabled. Database control is enabled. Pages production service binding points to the production Story Worker.
- Automatic production builds remain disabled; this was an explicit production deployment. DNS, mail, financial activation and Base44 retirement were not changed.

## Direct verification

The enabled Worker health returned200 with `enabled=true`; unauthenticated Worker access returned401. Actual anonymous PostgREST calls to Story draft,eligibility and privacy-deletion RPCs returned401. Live catalog inspection confirms all public Story wrappers are security-invoker,anon cannot execute them,and browser roles have no direct private-table grants.

Chromium on the production domain verified the new signup password-confirmation form,the protected Story page,the functioning same-origin service binding(401 without identity),and no horizontal overflow at390×844. Earlier owner-authorized real email-link login passed on the equivalent preview and reached the member-agreement gate. Agreements remain explicit owner actions; none was accepted by the builder.

Release checks passed:

- https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41774686336
- https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41774686279

Focused regression:18 Worker cases,9 executable Postgres scenarios,5 auth-helper cases,and11 mocked browser behavior checks. The confirmed Free-plan schema-mode AI smoke used317 prompt tokens,189 completion tokens and about47.16 neurons. No paid upgrade was enabled.

## Scope and next agent

Live capabilities are Story drafting,section rewrites,reviewed research/current-owner context,explicit scoped preferences,and creation/editing/cancellation of review drafts. They do not grant automatic publication,payment authority or campaign mutations. Full historical chat/skill/memory migration and specialist routing parity remain separately tracked; this release does not claim all original platform functions are complete.

The owner explicitly directed production activation followed by beginning the second agent. Strategy is now the active implementation; agent3 is not started. Its first source-backed Mission Brief request/schema/output contract and tests are in `worker/agents/strategy.js` and `tests/strategy-agent.test.js`. Runtime storage,authenticated transport,member UI,independent review and live acceptance are next.

## Rollback

Previous production Pages deployment: `321ccced-05bf-4c3b-bd3d-dd15401df69d` from `68bcbb4f8e7d6f1f665e3eb7056395841058dbf9`. Roll back the Pages artifact if needed,and disable the Story Worker/database control. Preserve canonical rows and the applied migration history; do not drop production data to roll back execution.
