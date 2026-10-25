# Kiro steering setup

The project's active workspace steering lives in `.kiro/steering/` and is automatically loaded by Kiro when this repository is opened as the workspace root.

Global guidance is supplied as a **template** in `docs/kiro/global-policies.template.md`. Git cannot install this file into a person's own Kiro home or cloud account.

To activate globally:
1. For Kiro IDE/CLI copy the template into `~/.kiro/steering/global-engineering.md`.
2. For Kiro Web, upload/sync via https://app.kiro.dev/settings/cloud-config and manage it under Agent Config > Steering. Check availability and account sign-in on the target Kiro surface.
3. For Kiro custom agents, explicitly add `"resources": ["file://.kiro/steering/**/*.md"]` to the agent config (in addition to any needed other resources).
4. Review that the instructions loaded in a new session. Only a Kiro session using the repository (or global/cloud setup) can confirm activation.

Do not put passwords, developer keys or environment secrets into steering. Reference https://kiro.dev/docs/steering for the supported inclusion modes and scope.

## Committed workspace agent
The repository includes `.kiro/agents/ifund-engineer.json` with
`"resources": ["file://.kiro/steering/**/*.md"]`.
The three foundation files `product.md`, `tech.md`, and `structure.md` are `inclusion: always` and now include live `#[[file:...]]` and one-level `#[[folder:...]]` references.
These are versioned on the Phase 1 PR branch, **not yet merged** into the integration branch or `main`.

## Supported CLI setup (development only)
From supported macOS/Linux/Windows CLI (not native Android Termux):
```sh
kiro-cli --version
kiro-cli login --use-device-flow
kiro-cli whoami
kiro-cli chat --v3 --cloud --repo interplanetarysister/InterplanetaryFund
```
Sign in through the device-code browser URL. For Kiro cloud, connect GitHub in https://app.kiro.dev/settings/integrations if it is not already linked and authorize access to this repository. Ensure the session checks out `migration/phase1-scaffold-inventory` before expecting to load these unmerged steering files. Verify Kiro workspace trust and use `/agent` to select `ifund-engineer`, or the default agent to auto-load foundation steering. Do not use `--trust-all-tools` for migration work.

## Global steering setup remains user-scoped
The existing template `docs/kiro/global-policies.template.md` is **not installed globally** by a repository commit. For IDE/CLI, copy to `~/.kiro/steering/global-engineering.md`; for Kiro Web/Cloud use https://app.kiro.dev/settings/cloud-config and Agent Config > Steering. Confirm with a new session; GitHub connection alone cannot enable personal global steering.

## Reference syntax
- Whole file across Kiro surfaces: `#[[file:AGENTS.md]]`
- Inclusive line range in IDE / CLI V3: `#[[file:docs/migration/STATUS.md:1-8]]`
- One-level folder list in IDE / CLI V3: `#[[folder:src]]`

Only attach paths actually present in the active worktree. Line ranges may drift after edits; prefer whole files for durable policy. Kiro custom agents can receive steering through `resources`; for additional custom agents, repeat that resource glob.
