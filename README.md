# Interplanetary Fund

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

**Open-source license: [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).** Copyright retained by the respective copyright holders. See [COPYRIGHT.md](COPYRIGHT.md) for ownership, brand/trademark and third-party licensing details. AGPLv3 permits compliant reuse and forks; it does not transfer copyright or grant trademark rights.

**Official website:** [https://interplanetaryfund.com](https://interplanetaryfund.com)  
**Canonical application source:** [https://github.com/interplanetarysister/InterplanetaryFund](https://github.com/interplanetarysister/InterplanetaryFund)

React/Vite frontend, Supabase backend, and Cloudflare infrastructure.  
This repository is the **independent migration destination** from Base44.

> **Important:** Vercel and Convex links are historical only and are **not** deployment targets.

---

## Migration Status

- **Verified deployment status (time-stamped):** [Cloudflare / GitHub deployment register](docs/operations/DEPLOYMENT_STATUS_20261115.md). This distinguishes successful production releases from queued builds and unfinished preview/native candidates.

- Authoritative migration and release coordination: **[issue #203](https://github.com/interplanetarysister/InterplanetaryFund/issues/203)**
- Original Base44 source repository: read-only functional reference
- Original Base44 app: legacy (not the canonical production URL)

The official domain (`interplanetaryfund.com`) is the **active Cloudflare Pages production website**. A narrowly scoped account-deletion release has been independently confirmed deployed; the wider migration and native store release are **not** certified. See the time-stamped deployment register above.  
The migration’s **user/admin, data, payment, and workflow acceptance tests must pass** before treating unverified features as accepted or retiring the Base44 reference.

A repository link does **not** prove that the destination site is fully deployed and ready.

---

## Historical Code

Pre-migration Convex / Vercel / FundForge code remains historical reference material in:

- Git history
- The branch `archive/pre-migration-2026-10-24`

**Do not** reuse old hostnames or secrets in new UI integrations.

---

## Stack

| Layer              | Technology                          |
|--------------------|-------------------------------------|
| Frontend           | React + Vite                       |
| Backend / Database | Supabase                           |
| Infrastructure     | Cloudflare (Pages, Workers, DNS, etc.) |
| Payments           | PayPal (via secure server-side integration) |
| AI                 | Integrated via backend services    |

---

## Development and Release Rules

Before publishing or making production changes, review:

1. `apps/web/DEPLOYMENT-GATES.md`
2. Authoritative migration and release coordination **[issue #203](https://github.com/interplanetarysister/InterplanetaryFund/issues/203)**
3. PayPal hackathon compliance ledger (`docs/hackathon/PAYPAL_2026_COMPLIANCE.md`, when present on the selected branch)

Use the **canonical Supabase project** and **Cloudflare account** only after verifying the intended environment and required approval gates.

**Keep production DNS, live payment processing, and the Base44 instance unchanged until explicitly authorized.**

---

## Repository Metadata Note

The GitHub **About → Website** field is repository metadata only and is **not** part of this README.  

It must be changed separately from its old Vercel value to: https://interplanetaryfund.com

This is done via repository settings or an authorized GitHub repository-administration API.

---

## Getting Started (Local Development)

```bash
git clone https://github.com/interplanetarysister/InterplanetaryFund.git
cd InterplanetaryFund
```

Follow the instructions in the relevant apps/ and documentation folders, and respect all deployment gates before any production-related actions.

## License

The original software in this repository is licensed under the **[GNU Affero General Public License, version 3.0 (AGPL-3.0)](LICENSE)**. See [COPYRIGHT.md](COPYRIGHT.md) for copyright, brand, and third-party notices. Third-party components retain their applicable licenses.

Status as of November 15, 2026: The independent Cloudflare Pages website is live, including an isolated account-deletion page release. Most staged route, backend, payment, agent-context, and native-app acceptance remains pending. Base44 source/APK remain preserved and read-only; do not infer migration completion from the domain being online.
