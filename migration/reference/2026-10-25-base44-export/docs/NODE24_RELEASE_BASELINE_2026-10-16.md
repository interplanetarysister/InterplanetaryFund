# Node.js 24 release baseline (2026-10-16)

- Project runtime minimum is Node 24.12.0, required by Firebase 13's locked @firebase/ai dependency.
- Version files and GitHub Actions setup-node use 24 as the tested build major, not a global hardcoded hosting runtime. New major versions require release checks before switching CI.
- Base44 development sandbox observed at Node 24.22.0. Base44 controls its internal automatic publisher: project version selectors are a request, not proof of that publisher's runtime.
- Cloudflare Workers Builds uses independently configured Node 24.18.0 and has successfully built/deployed IFund.
- Verify clean locked dependency installation, runtime contract, negative tests, production build and release postchecks, and final deployment before claiming production readiness.
- Node migration must not modify donations, processor reconciliation, fees, beneficiaries, financial records or payout algorithms.
