# Campaign translations: implementation and operations

## User-facing behavior

Campaign Detail displays a **Read campaign in** selector. Visitors choose the original text or an approved published translation. Owners and admins can select ten U.S.-prevalent languages, generate a translation intentionally, preview it, then publish it. Only the display-only campaign title, summary and story change; goals, donations, payments, original text, and beneficiaries do not.

Ten targets: English (en), Spanish (es), Simplified Chinese (zh-Hans), Tagalog/Filipino (tl), Vietnamese (vi), Arabic (ar), French (fr), Korean (ko), Portuguese (pt), and Hindi (hi). A separate **Original language** option restores the actual creator-written text. English is also a target for creators who write in another language.

This is a product support list informed by the 2024 ACS language-at-home estimates, not a claim that Simplified Chinese covers Cantonese or that every Census grouping has an exact one-language equivalent. References: [Census language methodology](https://www.census.gov/topics/population/language-use/about.html) and [ACS language-at-home data](https://usafacts.org/answers/how-many-people-speak-a-language-other-than-english-at-home/country/united-states/).

## Security, source preservation, and cost

- The campaign detail page only replaces rendered title, summary, and story. Donation components keep the original campaign and all financial values.
- The Base44 server function checks campaign visibility and ownership on every action. Guests can see published translations only; they cannot generate or publish translations.
- CampaignTranslation entity access is admin-only. Service-role storage is confined to the ownership-checked server function, so direct client entity writes cannot approve a translation.
- Generate is an explicit owner action that calls the existing Base44 Core.InvokeLLM service. This can consume AI credits, but is never invoked on page load or by anonymous visitors. The current-source cache prevents repeat calls for the same language.
- Every generated translation begins as an owner-only draft. Publish is explicit. SHA-256 fingerprinting of title/summary/story makes translations stale after any original-text edit, requiring regeneration and reapproval.
- Removing or archiving campaign content also deletes its cached translated copies. No payment ledger, payout or checkout records are modified.
- Language content may be inaccurate. The preview explains AI translation and advises comparison with the original. This scope excludes donations, comments, updates, financial notices, help legal text, and whole-site localization.
- If the original campaign text exceeds 24,000 characters, generation stops instead of silently truncating text. Runtime support and translation quality must be validated in Base44; repository code is not proof of live deployment.

## Open-source reuse assessment (2026-10-16)

1. [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate): maintained Python/ML self-hosted API, AGPL-3.0. Not selected: new deployment/hosting costs, privacy review, dependency operations, and AGPL compliance would be required.
2. [Argos Translate](https://github.com/argosopentech/argos-translate): MIT/CC0 Python offline translator; a potential future self-hosted adapter, but model installation and a hosted bridge would be needed outside Base44's Deno function runtime.
3. [react-i18next](https://github.com/i18next/react-i18next): MIT React internationalization helper. Suitable for future whole-app UI language localization, but does not translate user-authored campaigns.

Decision: reuse the existing Base44 LLM interface behind a narrow server function and avoid new external services or credentials now. Revisit an open-source provider only after verifying full language coverage, runtime compatibility, model rights, privacy, cost, security, and real operational tests.

## Verification and rollback

Run npm run verify:campaign-translations and standard web checks in a checked-out development environment. Also test owner review/publish, anonymous visibility, language changes, stale text, mobile controls, Arabic RTL display, preview errors and donation checkout unaffected. Manual backend/provider checks are pending until published to Base44 and must not be described as complete. Reverting the PR returns to original-only rendering without altering campaign financial data. GitHub commits and PRs do not trigger an APK rebuild; a bundled Capacitor APK needs a separate explicitly initiated build after publication.
