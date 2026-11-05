# Communications Agent preview candidate

Implementation starts from Growth preview commit `3bcdd92fff55f0b1cb75f3dd6627abbff541ae18`. Source contracts: Communications Agent and `sendCommunication` in the read-only `interplanetary-fund2` reference. This is a core drafting/review release; full source parity is not claimed.

## Implemented behavior

- Manual draft creation, editing, history, cancellation and reviewed in-app delivery require a confirmed active owner and current legal consent, without an AI plan. AI drafting separately requires the verified Basic+ entitlement.
- Drafts/history reuse `public.ifund_message`. Private cancellation metadata preserves existing message enums. All actual in-app deliveries use canonical `ifund_notifications`; no additional inbox or financial ledger is created.
- Each save, AI attempt, cancellation and delivery has an owner-scoped operation/lease receipt. Retries preserve the original result rather than re-executing it. UI reloads canonical state after receipt replay.
- AI receives bounded current campaign facts, organizer details, reviewed research and same-campaign message history. It never receives donor identities, emails, credentials or delivery tools. A goal is not a verified amount raised. Model output can only create an unsent subject/content draft.
- A private server preview binds exact saved text, revisions, message type, approved campaign scope and recipient identities. The owner sees exact text and aggregate audience counts. New arrivals cannot join a send or retry.
- Sending rechecks ownership, active confirmed recipient accounts, captured gifts and the current saved in-app preference. Shared row locks order these checks against competing preference/refund/account changes. Revalidation can remove recipients only. Multiple gifts are deduplicated and the sender is excluded.
- Actual notification inserts, message status/counts, audit and immutable receipt commit together. No eligible recipients means no delivery and the message remains a draft. No email/read confirmation is invented.
- Content is capped at 4,000 characters before review to match the live notification constraint. Volunteer/sponsor messages retain their message type and map to announcement notifications. Five messages per minute and 200 `(message, recipient)` deliveries per review are enforced.
- AI is limited to two global attempts per UTC day. Capacity for an in-progress draft is reserved against the 100-active-draft limit. Active drafts are ordered ahead of history so members can recover capacity by cancelling them.
- Supporter update preferences are visible in My profile and remain independent of AI access. They start enabled under the existing opt-out contract; this is not evidence of affirmative opt-in. Writes compare the prior JSON and verify the returned booleans. Epochs prevent a delayed initial read from replacing a newer saved opt-out.

## Verification actually performed

Independent Reviewer and Auditor passed 12 executable PostgreSQL scenarios, 11 Worker scenarios, 3 preference-helper scenarios and 11 browser checks. Browser checks include manual/free drafts, exact review with delivery off, explicit mocked sending, ambiguous receipt retry, exclusion of new drafts, stale review, cancellation, AI unsent drafts, account-switch cleanup, opt-out races and 4,000-character mobile notifications. No real supporter was contacted.

Actual Workers AI synthetic smoke returned a valid thank-you subject/content draft using 344 input / 73 output tokens, about 24.12 neurons. It does not prove authenticated hosted member execution or delivery.

The previously applied preference migration is now reconciled in source as `20261103192435_ifund_communications_preferences_20261103.sql`, exact 4,046-byte MD5 `35e938e608db6452f21243db052d362f`. It is not reapplied.

The reviewed schema is installed as `20261105111617_ifund_communications_agent_contracts.sql`: exact 31,739 bytes, MD5 `bfe70fddc94d8534d5c3442926686552`. Initial hosted inspection confirmed disabled draft/delivery controls; subsequent authorized activation enabled drafting with delivery still false. Hosted checks confirmed zero direct browser grants on private tables and eight authenticated-only security-invoker wrappers. Earlier expired confirmations caused no installation; the later confirmed call installed this exact source.

Preview Pages deployment `77811625-e855-4a33-88d2-9a0761c359b7` succeeded at `c88be1555445426c280fba4ab7bc35316a9833f5`; entry https://77811625.interplanetaryfund-migration.pages.dev/communications . Worker `ifund-communications-agent-preview` deployment `feed7802a6db4cd1beed18e77b342558` has drafting/AI enabled and in-app/email sending disabled. Actual hosted Chromium verified signup, member guard, same-origin workspace401, enabled Worker health with sending off, and390px mobile overflow. Full root36 and frontend24 test files passed. Positive hosted consenting-member execution remains NOT TESTED.

## Preview and remaining gates

The preview enables manual and AI drafting/review. Delivery remains off in both Worker and database. Email, recurring-supporter audiences, historical chat/learning, general content tools and real specialist dispatch remain integration work. Email needs a genuine configured provider and provider-backed receipts; no DNS/mail changes belong to this release.

The latest owner instruction supersedes the earlier production-after-Communications batch: continue sequential preview builds and hold production promotion until all remaining agents and required checks are ready. Next is Managed Connections. Story's actual campaign-cover generation/storage is now an explicit requirement in addition to its existing image prompt, using versioned IFund visual direction and verified campaign context.

Rollback disables this agent's controls and restores the prior Pages preview artifact, preserving messages, receipts, unrelated workflows and applied migration history.
