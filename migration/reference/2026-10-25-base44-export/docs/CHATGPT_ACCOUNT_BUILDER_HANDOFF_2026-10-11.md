# IFund admin frontend → personal ChatGPT builder handoff

## What is implemented
- `src/pages/Agents.jsx` already exposes **Admin tools** only for signed-in users whose frontend identity resolves to super-admin.
- `src/components/agents/AdminDevelopmentChat.jsx` now renders **ChatGPT account builder** and **Platform errors and fix plans** *before* and independently of the optional internal Base44 conversation unlock. The previous failure "admin session could not be started" does not hide this handoff.
- `src/components/agents/ChatGPTBuilderHandoff.jsx` creates and displays saved build assignments through the **existing** Base44 function `manageAdminBuilderWork` with mode `queue` and mode `list`. The backend requires a current authenticated IFund user with `role='admin'` and the established owner-email allowlist; a frontend role label alone cannot authorize a task.
- The component produces a bounded, inspectable task description and ID for the authorized owner. On supported devices it can invoke the native operating system share sheet; alternatively, users can copy the text and open `https://chatgpt.com/`. The fixed URL **never includes task contents, session tokens, or credentials**.
- `src/lib/chatgptBuilderHandoff.js` formats this task for **Interplanetary Fund's existing Base44 app** and connected ChatGPT tools, requesting inspection, implementation, local validation and an app restore checkpoint; it separates a queued task, actual source changes, verification and publication. It blocks common patterns resembling passwords, access tokens, and API keys before a request is copied.
- `scripts/test-chatgpt-builder-handoff.mjs` checks server-gated queue wiring, safe URL, prompt content, optional mobile sharing, secret blocks and independence from native admin-session initialization.

## How an owner triggers it
1. In IFund, sign in as the verified super-admin and open **AI Agents → Chief of Staff → Admin tools**.
2. Enter the implementation objective and optional non-secret acceptance context. Choose **Prepare ChatGPT builder task** (or **Existing tasks** to resume a previously approved task).
3. Choose **Share to ChatGPT app** on mobile if the native share dialog supports ChatGPT, or **Copy builder request** → **Open ChatGPT**. Make sure the intended personal ChatGPT account is active, paste or review the request, then **send** it in ChatGPT.
4. ChatGPT may use the account's existing connected Base44, GitHub and other authorized tools *only when actually available in that ChatGPT conversation*. The user can approve any required connection or action within ChatGPT; IFund never gets that plugin credential.
5. Inspect the output checkpoint/diff/tests and separately authorize publication. A task being queued, copied, shared or opened does NOT start a server-side ChatGPT run.

## Non-negotiable technical boundary
There is no supported way for a third-party IFund site to remotely impersonate or automatically invoke the user's existing personal ChatGPT conversation, ChatGPT subscription session, ChatGPT account-wide plugin authorizations, or the currently open chat on behalf of the user. A separate OpenAI API integration could serve an IFund embedded AI agent, but it would require its own authorized API billing and service/provider connections; it **would not be the same logged-in ChatGPT conversation with the account's plugins intact**. Do not swap in an API key and call it the user's existing ChatGPT account.

Do **not** expose or copy a ChatGPT session cookie, plugin tokens, private conversation URLs or OpenAI API secrets to the IFund frontend. Do not create a credential bridge to borrow another site's account login. ChatGPT plugins and their permissions remain managed in ChatGPT.

## Verification and release status
- Direct source check: `node scripts/test-chatgpt-builder-handoff.mjs`.
- Follow-on regression: `node scripts/verify-platform-wide-repairs.mjs`, `node scripts/verify-ifund-skill-migration.mjs`, `node scripts/verify-agent-write-capabilities.mjs`, `npm run build`.
- These are *source/build tests*, not a proof of published IFund session behavior, external ChatGPT account recognition, actual native share-target availability, or completed code changes from a handoff.
- No Base44 skills or agents were batch-synced; no paid builder turn or site deployment is part of this implementation.
