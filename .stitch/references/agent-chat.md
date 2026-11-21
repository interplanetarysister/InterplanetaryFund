# Agent chat

**Surfaces:** persistent `AgentSidePanel` and in-page AgentsTeam console.  
**Owners:** `apps/web/src/components/agents/GlobalAgentCompanion.jsx`, `AgentSidePanel.jsx`, `apps/web/src/pages/AgentsTeam.jsx`  
**Shell:** `GlobalAgentCompanion` wraps the whole router; the launcher is visible on public and private routes.  
**Capture:** @html/agent-chat-desktop.html, @html/agent-chat-mobile.html, @screenshots/agent-chat-desktop.png, @screenshots/agent-chat-mobile.png. Opened locally by dispatching `ifund-open-agent` for NEXUS. No question was typed or sent.

## Purpose

The chat is an advisory companion, not an autonomous operator. It stays available while the member browses, makes the selected specialist obvious, exposes access state plainly, and always returns to the full workspace.

## Two consoles, one identity system

- **Persistent side panel:** "Ask IFund" launcher → `GlobalAgentCompanion` event listener → `AgentSidePanel`. This is the docked/modal chat captured here.
- **In-page console:** `AgentsTeam.jsx` owns `#ask-mission-control` with its own textarea, specialist select, recommendation panel, and reply article. It is documented in @references/agent-team-overview.md#ai-team-overview.
- Both use `AGENT_IDENTITIES`, `AgentIdentityIcon`, consultation trails, advisory disclaimers, and the same fail-closed language.

## Side-panel anatomy

1. **Header.** Agent icon, name, role, 44px close button. Intro: "Keep browsing iFund while this advisory panel stays open."
2. **Agent switcher.** `.ifund-agent-panel-choices`, horizontally scrollable, 58px min-height tiles, `aria-pressed`, all identities available.
3. **Message log.** `.ifund-agent-panel-messages[role="log"][aria-live="polite"]` on `#151F30` with `#304057` border. Welcome empty state, user bubbles (`.user`, `#175D7E`, right), answers (`.answer`, `#26364D`, left), consultation trail, "Checking your question…", and `role="alert"` request/voice errors.
4. **Composer.** Quick site-nav links, availability status with sign-in or plans link, dictation/voice controls, "Listening… review before sending", textarea `#ifund-side-agent-question` (maxLength 2000), send button, "Open full workspace", and voice-optional disclaimer.
5. **Desktop vs mobile.** Desktop: inline `flex: 0 0 clamp(335px,36vw,520px)`, left border, no page overlay. Below 767px: fixed right sheet `min(100vw,480px)`, `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, body scroll lock, focus restored on unmount. At 390px padding tightens but controls remain 44px.

## Visual tokens

- Panel: `#090F1E` background, `#EFF6FF` text, `#35435B` left border, `-10px 0 35px #0002` shadow.
- Launcher: fixed bottom-right, 48px, `#101B37`, `#6CE1F1` border, cyan focus outline; above bottom nav on phones.
- Switcher: selected `#0C293D` with `#5FE6ED` border; 9px uppercase labels with `overflow-wrap:anywhere`.
- Focus: 2px `#70E3EF` in the panel; 3px high-contrast focus for close/tool/send controls.
- Motion: message scroll behavior becomes auto under reduced motion.

## Gate and state copy

Direct answers require `/api/agents/team/status` `configured === true`, a verified active `ifund_story_subscription` (integer level ≥ 1), a saved owner-scoped AI permission preference, a verified email-confirmed session, and an 8–2000 character question. Consent changes abort in-flight requests; account switches clear messages; campaign handoff rechecks ownership.

Preserve explicit states:

- "Checking agent access…" and reason strings for unauthenticated, deployment-unavailable, membership, permission, and verification failure.
- Empty welcome message; "Checking your question…"; request and voice alerts.
- Mic-start, unsupported-browser, listening/review-before-sending states.
- Advisory disclaimer: no posting, paying, publishing, or moving money.
- "Open full workspace" link back to `/agents`.

## Accessibility

The panel is non-modal on desktop and modal on mobile. Message log is live; status and errors are textual. Focus order runs header → switcher → messages → composer. Escape closes only the mobile sheet. Agent switcher state is exposed with `aria-pressed`; voice controls have accessible names. No private conversation text is stored in public training files.

## Source crosswalk

`GlobalAgentCompanion.jsx` · `AgentSidePanel.jsx` · `AgentIdentityIcon.jsx` · `AGENT_IDENTITIES` · `TeamConversationHistory.jsx` · `askIFundAgent` · `canAskAgentWithSavedPermission` · `styles/agent-companion.css` · `styles/agent-team.css`.

## Stitch variation guidance

Vary bubble radius, panel texture, switcher treatment, and empty-state illustration. Do not remove availability copy, advisory disclaimers, voice status, focus trap, consultation trail, or the full-workspace link. Never show a successful answer in a design mock as proof that hosted inference, membership, permission, or provider grants are active.
