Interplanetary Fund

**Official website:** [https://interplanetaryfund.com](https://interplanetaryfund.com)  
**Canonical application source:** [https://github.com/interplanetarysister/InterplanetaryFund](https://github.com/interplanetarysister/InterplanetaryFund)

React/Vite frontend, Supabase backend, and Cloudflare infrastructure.  
This repository is the **independent migration destination** from Base44.

> **Important:** Vercel and Convex links are historical only and are **not** deployment targets.

---

## Migration Status

- Migration tracking: **Issue #137**
- Migration pull request: **PR #165**
- Original Base44 source repository: read-only functional reference
- Original Base44 app: legacy (not the canonical production URL)

The official domain (`interplanetaryfund.com`) is the intended public entry point.  
However, the migration’s **user/admin, data, payment, and workflow acceptance tests must pass** before cutting over or retiring Base44.

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
2. Migration issue **#137**
3. Migration pull request **#165**

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

Follow the instructions in the relevant apps/ and documentation folders, and respect all deployment gates before any production-related actions.

License
[Add license here]

Status as of November 2026: Independent migration in progress. Base44 remains the current live system until acceptance tests pass and cutover is explicitly approved.
