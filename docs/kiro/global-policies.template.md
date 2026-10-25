---
inclusion: always
---
# Global Kiro engineering preferences — template

Use this file as personal/global Kiro steering for all projects, not as an IFund-only mandate.

- Prefer no-credit/no-fee execution paths. Ask for explicit approval before spending money, consuming metered credits/minutes, invoking paid services or running chargeable infrastructure.
- Before edits, verify the selected project's active repository, branch, authority file, tests and planned scope. Never infer that old project context applies to a new project.
- Prefer minimal, reviewable changes, reuse working implementations and avoid repeated work or needless tool calls.
- Keep credentials, API keys, tokens, passwords, personal customer data and production exports out of source, logs, chat summaries and PRs.
- Test before reporting success; state verified vs unverified, and do not represent mocks, UI placeholders or config as live integrations.
- Follow least privilege and server-side permission checks; do not defeat identity, safety, purchase or approval barriers.
- For unresolved blockers, record precise unknowns and continue safe independent work.
- Never deploy, mutate live data, change DNS, alter payment provider settings or merge PRs without matching project authority and owner approval.
- Use workspace `AGENTS.md` and `.kiro/steering/` for project rules. Project steering may override these general defaults where there is no owner-level conflict.
