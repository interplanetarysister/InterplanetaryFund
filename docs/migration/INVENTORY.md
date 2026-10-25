# Base44 source inventory — `interplanetarysister/interplanetary-fund2` @ main
Source of truth: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137). Source was read through authenticated GitHub connector; source repo is read-only. These are static analysis results, not live-state or runtime exports.
## Definition census (verified by Git tree)
- 95 entity contracts (`base44/entities/*.jsonc`). Required fields, property names/types/enums/defaults and declared RLS were inspected in per-entity appendices.
- 184 backend function entrypoints (`base44/functions/*/entry.ts`). Per-file static name-based purpose, detected entity calls, selected API hosts and secret name references were recorded. **Not implementation parity**.
- 11 connector definitions; 10 agent definitions; 17 workflow definitions; 1 MCP file.
- 364 frontend JS/TS/JSX/TSX files in src. Full caller tracing and every `base44.*` call site are **not yet complete**; this remains a Phase 1 gap.
## Entity contracts
- [Fields + RLS 1–15](inventory/ENTITIES_001_015.md)
- [Fields + RLS 16–30](inventory/ENTITIES_016_030.md)
- [Fields + RLS 31–45](inventory/ENTITIES_031_045.md)
- [Fields + RLS 46–60](inventory/ENTITIES_046_060.md)
- [Fields + RLS 61–75](inventory/ENTITIES_061_075.md)
- [Fields + RLS 76–90](inventory/ENTITIES_076_090.md)
- [Fields + RLS 91–95](inventory/ENTITIES_091_095.md)
## Backend functions
- [Function details 1–16](inventory/FUNCTIONS_001_016.md)
- [Function details 17–32](inventory/FUNCTIONS_017_032.md)
- [Function details 33–48](inventory/FUNCTIONS_033_048.md)
- [Function details 49–64](inventory/FUNCTIONS_049_064.md)
- [Function details 65–80](inventory/FUNCTIONS_065_080.md)
- [Function details 81–96](inventory/FUNCTIONS_081_096.md)
- [Function details 97–112](inventory/FUNCTIONS_097_112.md)
- [Function details 113–128](inventory/FUNCTIONS_113_128.md)
- [Function details 129–144](inventory/FUNCTIONS_129_144.md)
- [Function details 145–160](inventory/FUNCTIONS_145_160.md)
- [Function details 161–176](inventory/FUNCTIONS_161_176.md)
- [Function details 177–184](inventory/FUNCTIONS_177_184.md)
## Connector, agent and workflow contracts
- [Connectors](inventory/CONNECTORS.md) (provider configuration shape; actual OAuth tokens UNKNOWN)
- [Agents](inventory/AGENTS.md) (10 agent definitions)
- [Workflows 1](inventory/WORKFLOWS_01.md) and [Workflows 2](inventory/WORKFLOWS_02.md)
- MCP definition: [base44/mcp/config.json](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/mcp/config.json). Source configuration needs per-route security review.
## Frontend and schema dependencies
- Direct frontend API bridge: [src/api/base44Client.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/api/base44Client.js) uses @base44/sdk and rewrites the server URL for alternate hosts. Replaced by src/lib/supabase.js only for the *preview subset*.
- Frontend used Base44 CRUD (`base44.entities`), `auth`, hosted `functions.invoke`, Core services, connectors, and agent chat. Complete file/line inventory of these uses remains open; do not claim no Base44 dependencies in the source.
- Source `base44/functions/setupPayPalSubscriptionWebhook/entry.ts` hardcodes a Base44 callback URL. Financial handlers require provider-dashboard verification (see BLOCKERS).
- `ifund_ops` private schema and 25 applied Supabase migrations already exist. This preview SQL only sketches 3 public tables; **do not apply until the full schema/RLS plan is reviewed**.
## Prioritized inventory gaps
1. Cross-reference every `base44.*` frontend call (file, line, function, auth scope) to target adapter or edge function.
2. Capture each backend function’s real callers, trusted/anonymous context, request/response types and side effects; static name/regex extraction does not prove semantics.
3. Define replacement for each connector, agent tool and workflow trigger with secret requirements, billing and idempotency.
4. Complete 95-entity Postgres/RLS schema, user ID mapping, and financial isolation.
5. No test data export has been run. Source code count is not a live row count.
## Security
Do not put old credential-vault values, tokens, donor PII, or raw function outputs in inventory documents. Never substitute inferred connectivity for verified provider state.
