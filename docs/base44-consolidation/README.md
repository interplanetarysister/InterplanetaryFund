# Base44 Consolidation

Source: `interplanetarysister/interplanetary-fund2`
Target: `interplanetarysister/InterplanetaryFund`

## Rule
One Interplanetary Fund product. Convex remains the canonical live data/backend source. User-facing and admin views must read the same records so updates are live and consistent.

## Imported for migration
- `chief_of_staff.jsonc`
- `communications_agent.jsonc`
- `finance_agent.jsonc`

## Remaining Base44 agent definitions to reconcile
- `growth_agent.jsonc`
- `outreach_agent.jsonc`
- `story_agent.jsonc`
- `strategy_agent.jsonc`

## Entity migration
Base44 entities must be reconciled against `InterplanetaryFund/convex/schema.ts` before runtime migration. Do not create duplicate production tables or competing sources of truth.

## Deployment
Vercel remains attached to `InterplanetaryFund`. The Base44 repository is being consolidated into the active application rather than becoming a second Vercel deployment.
