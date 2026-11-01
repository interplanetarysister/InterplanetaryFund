# Original Base44 workflow inventory — live connector read, 2026-11-01

Source: Base44 app `6a67a778342a8fe05ee79cba`, read-only GET workflows. This is a migration snapshot, not verified functionality or approval to execute.

**Count: 19. Active: 4. Inactive: 15.**

The historical 17-workflow contract ledger must be reconciled against these 19 current records by IDs, trigger, behavior and side effects. Do not duplicate schedules or auto-enable payment/outreach workflows. Leave Base44 running until all records, owners, integrations and feature behavior are verified.

| Workflow | Base44 ID | Trigger | Status | Reported reason |
|---|---|---|---|---|
| IFund Reporter Daily Diary | `6ac9c3704cd253e3b6c4baf6` | scheduled | inactive | workflows_not_available |
| IFund Official Social Editor | `6ac9bbe3ccd8293e84349b62` | scheduled | inactive | workflows_not_available |
| Weekly Writing Psychology & Social Trends Training | `6ac9bafda10e147b29a4e72b` | scheduled | inactive | consecutive_failures |
| Future Workflow Registry | `6ab446399b180129557a306a` | entity | inactive | workflows_not_available |
| Integration Health Check | `6ab445e6f784c7aa60a131cf` | scheduled | inactive | workflows_not_available |
| External Fund Sync | `6ab445d712ec5013ebff9328` | scheduled | inactive | consecutive_failures |
| Admin Action Conversation Router | `6ab41ae5f6b7e2a094a0c274` | scheduled | inactive | consecutive_failures |
| Platform Account Steward | `6ab4170cc6b27ba8a9eadd53` | scheduled | inactive | workflows_not_available |
| PayPal Holding Settlement Reconciliation | `6ab2e793646413d5557ea201` | scheduled | inactive | consecutive_failures |
| External Feed Mirroring | `6ab1a08108d4a9be3dfd4db9` | scheduled | inactive | workflows_not_available |
| Social Media Autopilot | `6ab1a08108d4a9be3dfd4db6` | scheduled | inactive | workflows_not_available |
| Feature Discovery on Completion | `6a96fe327439d6ce0ccd52d4` | entity | active | — |
| Campaign Sync on Create | `6a96fd316b99c1b6d4a5edeb` | entity | inactive | workflows_not_available |
| Campaign Sync on Update | `6a96fd316b99c1b6d4a5ede9` | entity | active | — |
| Volunteer Welcome Follow-up | `6a96fd316b99c1b6d4a5ede6` | entity | active | — |
| Grant Application Review | `6a96fd316b99c1b6d4a5ede4` | entity | active | — |
| Campaign Protocol | `6a6d9f9caafcff94608be9a3` | entity | inactive | workflows_not_available |
| Connection Sync Engine | `6a6cfeba1eb94d299d05450b` | scheduled | inactive | workflows_not_available |
| AI Outreach Agent | `6a6c2e8cc4e17b42d4cadfa8` | scheduled | inactive | workflows_not_available |

## Required migration acceptance for each workflow

- Identify and inspect original handler source, entity dependencies, actor role, permissions, side effects, provider credentials and quotas.
- Match existing Supabase/Cloudflare implementation before writing duplicate code.
- Implement independent scheduling or entity-event trigger with idempotent claim/lease and per-destination consent.
- Unit-test failure/retry and concurrency; two-account authorization tests; prove original behavior with dry-run logs.
- Keep financial transfers, outbound posting and third-party API calls disabled until owner approval and provider-side verification.
- Explicitly record replacement Worker/function and evidence in the release ledger. Do not claim parity merely because a Worker name exists.
