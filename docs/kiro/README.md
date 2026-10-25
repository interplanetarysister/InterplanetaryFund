# Kiro steering setup

The project's active workspace steering lives in `.kiro/steering/` and is automatically loaded by Kiro when this repository is opened as the workspace root.

Global guidance is supplied as a **template** in `docs/kiro/global-policies.template.md`. Git cannot install this file into a person's own Kiro home or cloud account.

To activate globally:
1. For Kiro IDE/CLI copy the template into `~/.kiro/steering/global-engineering.md`.
2. For Kiro Web, upload/sync via https://app.kiro.dev/settings/cloud-config and manage it under Agent Config > Steering. Check availability and account sign-in on the target Kiro surface.
3. For Kiro custom agents, explicitly add `"resources": ["file://.kiro/steering/**/*.md"]` to the agent config (in addition to any needed other resources).
4. Review that the instructions loaded in a new session. Only a Kiro session using the repository (or global/cloud setup) can confirm activation.

Do not put passwords, developer keys or environment secrets into steering. Reference https://kiro.dev/docs/steering for the supported inclusion modes and scope.
