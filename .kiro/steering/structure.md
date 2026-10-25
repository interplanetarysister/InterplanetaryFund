---
inclusion: always
---
# IFund structure and source-of-truth map

Canonical target: `interplanetarysister/InterplanetaryFund`.
Integration branch: `migration/supabase-cloudflare`.
Current Phase 1 work: `migration/phase1-scaffold-inventory` in PR #138.
Read-only source: `interplanetarysister/interplanetary-fund2`.
Archived legacy branch: `archive/pre-migration-2026-10-24` is historical reference only.
Obsolete PR #136 must not be merged.

## Expected paths
- `AGENTS.md`: rules for all coding agents, subordinate to owner decisions in issue #137.
- `.kiro/steering/`: shared, versioned Kiro workspace guidance.
- `src/`: client pages/components; `src/lib/supabase.js` holds publishable frontend client only.
- `supabase/migrations/`: reviewable SQL changes (not proof they ran).
- `supabase/functions/`: server-side Edge Functions as features are ported.
- `host/` or Worker config paths: Cloudflare Worker gateway, verified against checked-in files.
- `docs/migration/INVENTORY.md`: source contracts and call sites.
- `docs/migration/STATUS.md`: seven phase checklist with evidence.
- `docs/migration/BLOCKERS.md`: unresolved details with impact and next safe action.
- `docs/kiro/`: global-policy template and setup instructions, **not** active workspace/global steering automatically.

Do not invent absent files or treat planned folders as deployed code. Inspect structure on the current branch first. Prefer small targeted changes and preserve the repository's existing naming, imports, tests, and error-handling patterns.

## Migration discipline
Each of the seven phases gets a reviewable PR into the integration branch, never directly into main; add steering work to the existing Phase 1 PR. Do not merge without review gates. Keep branch and PR descriptions truthful about local-only, sandbox, integration, and live verification.

## Live workspace references
These one-level folder listings track actual checked-in paths. A missing path indicates unfinished scaffold, not permission to invent a deployed resource.

#[[file:AGENTS.md]]
#[[folder:src]]
#[[folder:supabase]]
#[[folder:.kiro/steering]]
