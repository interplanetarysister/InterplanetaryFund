# P0 current-main reconciliation

This branch starts from canonical current `main` and reconciles the validated serialized Convex automation lane without dropping newer Browserbase, outreach, campaign, or financial-integrity work.

Release gates: exact-head Node 24 install/typecheck/build, Convex codegen/bundling, automation static verifier, singleton provisioning, single-winner lease claim, stale-worker fencing, duplicate/manual overlap suppression, current outreach dispatcher preservation, and Development runtime validation before Production promotion.
