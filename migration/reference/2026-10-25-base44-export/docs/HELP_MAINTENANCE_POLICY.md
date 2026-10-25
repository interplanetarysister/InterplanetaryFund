# IFund Help maintenance rules (web + APK)

Every user-facing action must have easy, current instructions in IFund's Help Center.
When a step, button, permission, warning, password option, payment action, or app
connection behavior changes, modify or add the matching help guide in the same
change. Use words a young child can follow, one action per sentence, and the
exact visible button text. Explain what happens when something is not ready.
Do not advertise a feature as working while its provider or backend is staged.

For tracked workflows, update `src/lib/connectionHelpGuides.js` and then
regenerate hashes in `docs/HELP_UPDATE_CONTRACT.json` after reviewing the
workflow changes. The build checks hashes and that each matching help page
exists. The hashes are a reminder of required review, not proof that a guide
is accurate. New user workflows must be added to the contract and Help Center.
`src/lib/helpCenter.js` maps the page to its help topic.

For broad changes, review every affected flow (web and Android), especially:
registration; campaign creation; AI/OBO switches; donation checkout; payments,
balances and withdrawals; social content and publishing; community; account
security; connections; subscription and billing; private messages; help.
Any missing or stale article is a release blocker until fixed.
