---
inclusion: always
---
# Universal engineering rules for this IFund workspace

1. **Safety and authority:** Follow the latest explicit owner instructions, GitHub issue #137 and `AGENTS.md`. Do not use archive branch instructions to override current decisions. Do not evade access, identity, consent, provider, or deployment safeguards.
2. **Credit controls:** Prefer free/no-credit methods. Never start a paid job, paid CI runner, credits-consuming service, chargeable AWS operation, or paid third-party API call without explicit owner approval for that consumption. Estimate and identify the charge first.
3. **Verify before changing:** Read relevant current files and tests; reuse functioning work; identify the exact component, impacted contracts and rollback. Don't repeatedly reinspect unchanged evidence without need.
4. **Authz/security:** Authenticate and authorize on the server. Enforce owner/tenant boundaries, Postgres RLS, private vault protection, redacted logs, least privilege and auditable privileged changes.
5. **Money:** Require atomic and idempotent money operations, verified signed payment callbacks and ledger reconciliation. No fabricated transactions, payouts, donation counts or provider statuses.
6. **Migration:** Never modify the source repository, live Supabase data, production DNS, running provider settings or actual user accounts as a side effect of documenting/testing. Do not run destructive SQL.
7. **One blocker is not a full stop:** Document UNKNOWNs with evidence, exact blocker, next action and scope in `BLOCKERS.md`; continue unblocked work. Never claim an unverified item passed.
8. **Tests and reporting:** Run the cheapest relevant available tests first. For each PR record exact checks, dates/systems, what was not tested and remaining risk. A passed static/build test never proves runtime parity.
9. **Privacy:** No credentials, PATs, OTPs, customer private data, live tokens or unredacted exports in code, docs, prompts, screenshots, PRs or tests. Use placeholders and secret managers.
10. **Agent interactions:** Kiro custom agents must explicitly include `file://.kiro/steering/**/*.md` in their `resources` to get these documents. Avoid showing end users internal specialist deliberations or privileged backend instructions.
