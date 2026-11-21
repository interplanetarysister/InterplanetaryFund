# AI team overview

**Routes:** `/agents` and `/mission`  
**Owner:** `apps/web/src/pages/AgentsTeam.jsx`  
**Shell:** Inside `Layout`; global agent launcher and side panel available.  
**Capture:** @html/agent-team-overview-desktop.html, @html/agent-team-overview-mobile.html, @screenshots/agent-team-overview-desktop.png, @screenshots/agent-team-overview-mobile.png. Captured unauthenticated; admin-only and signed-in modules are source-derived.

## Purpose

This is the specialists' directory and full advisory workspace. It explains what each of the nine agents is for, lets a member ask a question with a saved permission, and links into deeper service workspaces. DISCOVER is consolidated into LINK in the visible grid but remains part of the shared identity system.

## Section order

1. **Hero.** `.ifund-agents-hero` with kicker "Interplanetary Fund · Mission Control", headline "Your mission. Your AI Team.", lede, "Ask Mission Control ↗" anchor to `#ask-mission-control`, and `.ifund-agents-chip` row. Orbit ellipse and dot grid are pseudo-element background layers.
2. **Operations Room.** `AgentOperationsRoom` renders only for verified admins; non-admins see nothing.
3. **Specialist grid.** `AGENT_WORKSPACES.filter(a => !a.consolidatedInto)` as `.ifund-agents-grid` buttons with `--agent-accent`, `AgentIdentityIcon size=70`, name, role, arrow, and `aria-pressed`. Clicking also opens the global side panel. ORBIT is labelled "Your fundraising finances and verified donations"; it explains records and cannot move money or initiate withdrawals.
4. **Ask Mission Control console.** `#ask-mission-control` with textarea `#agent-specialist-question` (8–2000 chars), specialist select `#ifund-agent-choice` ("auto" plus team), `proposedSpecialistHandoff` recommendation panel, `.ifund-agents-submit`, and advisory note.
5. **Reply article.** `.ifund-agents-reply` on success with consultation trail, "Review this answer in a campaign editor" (`rememberAgentAdvice` → navigate), and advisory disclaimer.
6. **Selected specialist detail.** `.ifund-agents-detail` with identity, role, handles, consults from `TRAINING_ROLES`, evidence string, and per-role workspace: NEXUS → `NexusBrief`; POLARIS/FORGE/ECHO/LINK → `SpecialistServiceWorkspace`; STORY → writing assistant; others → `agentToolHref` link. "Return to team" closes the detail.
7. **Signed-in modules.** `EditorialAgentQueue` and `TeamConversationHistory` with their own loading/empty states.
8. **Writing studio.** `.ifund-agents-writing` toggle for `StoryAgent`.

## Visual tokens

- Page: `max-width:1180px`, `padding: clamp(1rem,2.5vw,2rem) ... 6rem`, `min-width:0` on all children.
- Hero: `#07111F → #101C35 → #131635`, 28px radius, 1px `rgba(157,191,241,.30)`, purple/teal radial fields, 60px shadow, oversized orbit rings.
- Kicker: `#6EF1E7`, 0.71rem/800/0.22em uppercase. Headline: Manrope 2–3.45rem, 800, -0.045em; accent word `#88F2EB`.
- Cards: 2/3/4 columns, 168–178px min-height, 21px radius, `#0B1424 → #111B30`, top accent rule, 125px orbit arc, hover lift.
- Console: 25px radius, `#0F1F37 → #08101F`, gradient border mask, 15px form controls, `#73E9E5` focus ring, `#5BE6DC → #83A3FF` submit.
- Chips: pill, `rgba(255,255,255,.07)`, mint dot with glow.
- Focus: 3px `#6BE9DC`, 4px in high contrast; hover transforms disabled under reduced motion.

## Gate and state copy

Gateway checking / not enabled; membership loading / free matching available / could not be verified; AI permission loading / unavailable / disabled; question error; busy "Asking your agent…"; reply panel; guest sign-in prompts; invalid campaign link; `TRAINING_VERSION` footer. Specialist cards and directory remain visible to guests; private workspaces and writing studio require sign-in; direct answers require the same verified checks as the side panel.

## Responsive and accessibility

Grid steps 2→3→4 columns and collapses to one at 390px; card min-height shrinks at 420px. Section headings and console labels remain readable with `overflow-wrap:anywhere`. All buttons, selects, and textareas are at least 44px. `aria-current`, `aria-pressed`, `role="alert"`, and visible focus are part of the contract. Route scroll margin is 96px for anchors.

## Source crosswalk

`AgentsTeam.jsx` · `AGENT_WORKSPACES` · `TRAINING_ROLES` · `AgentOperationsRoom.jsx` · `NexusBrief.jsx` · `SpecialistServiceWorkspace.jsx` · `StoryAgent.jsx` · `EditorialAgentQueue.jsx` · `TeamConversationHistory.jsx` · `AgentConsultationTrail.jsx` · `styles/agent-team.css` · `styles/agent-companion.css`.

## Stitch variation guidance

Vary hero geometry, card illustration, and console surface treatment. Preserve the specialist identities and colors, DISCOVER/LINK consolidation, advisory disclaimers, admin-only room behavior, permission states, and source-labeled evidence. Do not make the directory look like a live provider authorization panel.
