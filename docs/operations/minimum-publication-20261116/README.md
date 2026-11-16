# Minimum campaign publication requirements

Owner instruction: the bare minimum is title, story and amount. Summary, cover image, story length, paragraph structure, readiness scores and editorial review are optional. Authentication, current member agreement, campaign ownership and validation of supplied fields remain in force.

The canonical client and Worker now accept a short nonempty story with no summary. The three-page creator keeps description and story together and retains owner-scoped recovery and all nine agent feature links. Versioned draft progress migrates old four-stage records exactly once; current stage saves remain stable across repeated normalization.

CLI migration `20261116160726_ifund_minimum_campaign_publication.sql` was applied to canonical Supabase as `ifund_minimum_campaign_publication`. The validated table constraint and existing publication trigger both require non-whitespace title/story and a positive finite amount. Other constraints, column grants and RLS remain unchanged. Live policy hash remains `fe8b25d83e7bacd5896d3df3802f288b`. No campaign records were edited or published by the migration.

Automatic approval review rejected the initial no-op trigger proposal. The implemented revision instead retains explicit minimum-field enforcement in the trigger and includes a fingerprint preflight that aborts on unexpected trigger changes. The narrowed revision was accepted and applied; no rejection was bypassed.

Actual PGlite tests cover direct publication, repeated migration, missing/whitespace fields, zero/null/NaN/infinite amount, cross-owner reads/writes and owner isolation. Client/Worker tests cover the same minimum publication contract. Desktop/mobile browser checks of the compiled artifact used a short story and blank summary, including interrupted-save recovery with one campaign insertion; HTTP/Auth transport was synthetic and does not certify live member/provider acceptance.

Production deployment remains conditional on full-site acceptance. This change does not weaken the existing release gate, enable payments/agents/providers, or apply unrelated pending migrations.
