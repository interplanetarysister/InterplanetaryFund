# Interplanetary Fund

**Purpose: Frontend**

Authoritative user-facing React + Vite application for the single Interplanetary Fund product.

## Product Build Contract

Interplanetary Fund is **one cohesive product implemented across coordinated repositories**. Repositories are implementation boundaries, not separate products.

### Repository purposes

| Repository | Purpose | Authority |
|---|---|---|
| `interplanetarysister/InterplanetaryFund` | **Frontend** | User-facing React/Vite application |
| `interplanetarysister/interplanetary-fund-backend` | **Backend** | Backend, admin, agents, security, treasury, operations |
| `interplanetarysister/interplanetary-fund` | **Migration** | Historical/reference source until every unique capability is reconciled |

### Build-agent rule

Every build agent, workflow, Copilot/Codex task, and human implementation must treat the three repositories as **one product**. Before changing code, identify the repository purpose and determine whether the capability is frontend-only, backend/operations-only, or cross-repository.

For cross-repository work, implement and verify the complete capability across all affected repositories. Do not create competing production sources of truth.

Live campaigns, users, donations, permissions, agent state, administrative state, and other business entities must retain one canonical live identity in the authoritative backend. The frontend consumes that canonical state; it must not create a competing production database.

### This repository owns

- User-facing React/Vite application
- Campaign discovery and user workflows
- Campaign creation/editing interfaces
- Donor and campaign experiences
- User navigation, settings, profile, community, and help surfaces
- Frontend integration with the canonical backend
- User-facing responsive/mobile experience

### This repository does not independently own

Backend business truth, admin monitoring, agent runtime, treasury authority, security enforcement, scheduled backend jobs, or operational infrastructure. Those belong to `interplanetary-fund-backend`.

## Build Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Release Rule

A frontend change is production-complete only after affected backend contracts, permissions, environment configuration, and end-to-end flows have been verified. A successful Git push alone is not a complete product release.

See `PRODUCT_SYSTEM_CONTRACT.md` for the authoritative cross-repository contract.
