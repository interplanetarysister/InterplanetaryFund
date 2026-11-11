# IFund Atlas and campaign metrics release — 2026-11-11

## Production source and preview evidence

- Source: `apps/web` in `interplanetarysister/InterplanetaryFund` (Cloudflare Pages `interplanetaryfund-migration`).
- Preview branch: `feature/atlas-donuts-live-20261111`.
- Verified preview deployment: `https://207a1b3a.interplanetaryfund-migration.pages.dev/globe`, 256/256 project tests passing.
- The Atlas browser route renders the same free orthographic globe used in the separately deployed sandbox demo.
- The preview browser successfully loaded all 26 active campaigns; no campaign has opted in to a map marker yet, so the empty pinned state is expected and does not infer location.

## Consent, data, financial boundaries

1. An organizer explicitly opts in to sharing approximate city/region map coordinates in the Create/Edit campaign flow. Raw browser geolocation is rounded to one decimal before storage; opting out clears the public location fields. The database enforces this constraint, and row-level security restricts writes to the owner.
2. Anonymous public map readers receive SELECT access only to four new public location columns, in addition to the existing column-level grants. Existing RLS exposes only active campaigns; the anonymous role has **no** SELECT access to `owner_id`.
3. AG Charts Community donut charts show only PayPal-verified captured funding from canonical financial RPCs; no sandbox or synthetic receipts are added to real balances.
4. The live agent-focus chart is strictly owner-only and counts actual stored task entries by category and status. It does not claim automated work, hours or financial results from pending tasks.
5. AG Grid Community is used for the owner finance explorer. No paid AG Charts maps or Enterprise grid modules are used.
6. The PayPal Hackathon standalone demo keeps fictional campaigns, synthetic agent focus and sandbox transactions separate from live IFund.

## Release gates

- Cloudflare Pages preview tests and runtime Atlas route must pass before production promotion.
- Do not fabricate map positions, pretend sandbox payments are live, change DNS or enable payments as a side effect of Atlas deployment.
- The Base44-hosted original app is outside this Cloudflare release; its direct source edit integration currently requires a higher Base44 workspace tier.
