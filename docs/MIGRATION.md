# IFund migration plan — issue #137
Source: [interplanetarysister/interplanetary-fund2](https://github.com/interplanetarysister/interplanetary-fund2) (read-only), not `interplanetaryfund-base44`. Destination: InterplanetaryFund migration branch.

This is a **preview scaffold**, not production parity. Cloudflare Pages will host React/Vite; the Worker serves independently developed APIs; Supabase provides Auth/Postgres/Storage/Edge Functions. Wix keeps marketing hosting until authorized cutover.

Read [BLOCKERS](migration/BLOCKERS.md), [STATUS](migration/STATUS.md) and [INVENTORY](migration/INVENTORY.md). The initial SQL in `supabase/migrations/20261025011400_initial.sql` is **unapplied staging-only proposal** with three illustrative tables; it does not map all 95 entities. Respect existing private `ifund_ops` and shadow schema. No live data was imported, no secrets migrated and no DNS or deployment changes were performed.
