# Placeholder Audit — 2026-08-24

## Scope

Audited the repositories currently associated with Interplanetary Fund:

- `interplanetarysister/InterplanetaryFund`
- `interplanetarysister/interplanetary-fund`
- `interplanetarysister/interplanetary-fund-backend`
- `interplanetarysister/interplanetary-fund2`

The private Base44 repository was also included in the repository inventory, but no actionable platform-data placeholder implementation was found there during this audit.

## Findings

### 1. External platform URL cleanup used hard-coded placeholder values

The Convex platform cleanup code contained `F`, `H`, `D`, `Jjj`, and an empty string as placeholder URL values. The scheduled backend cleanup repeated the same list. This was an implementation placeholder rather than a complete validation rule.

### 2. Invalid URL detection was too weak

The prior logic primarily used string length and exact placeholder matching. That could allow non-URL strings to remain associated with platform records.

### 3. Placeholder UI text was not treated as a defect

Normal HTML/input placeholder attributes such as `Temporary access code` are intentional user-interface affordances and were not removed merely because they contain the word `placeholder`. The temporary admin gate remains an explicit maintenance UI, not a fake platform connection.

### 4. `interplanetary-fund2` platform catalog was reviewed

The platform catalog describes API availability and approval requirements rather than using fake credentials or fake URLs. No placeholder platform URL implementation was identified there.

## Corrections Implemented

### `interplanetary-fund-backend`

Updated `convex/cleanupPlatforms.ts` and `convex/cleanupPlatformsInternal.ts` so platform URLs are classified as invalid when they are empty, known placeholder/test values, contain placeholder/example markers, or are not valid HTTP(S) URLs with a hostname. Invalid connections are forced to `draft` and therefore cannot be treated as publishable external accounts.

### `interplanetary-fund`

Updated `convex/cleanupPlatforms.ts` with the same validation policy so the application-side cleanup behavior matches the backend behavior.

## Verification

The modified files were re-read from GitHub after writing to confirm the new validation logic is present on `main`.

GitHub's code-search index still returned stale references to the old `Jjj` implementation immediately after the writes; direct file reads confirmed the current `main` contents contain the new validation logic. The stale search results are therefore not treated as evidence that the old implementation remains in the live files.

## Remaining Status

No additional actionable platform-data placeholder implementation was found in the audited repositories. Placeholder-like text that is normal UI copy, documentation, or intentional empty input state was left unchanged.
