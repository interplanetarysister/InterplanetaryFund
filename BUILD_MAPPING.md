# Interplanetary Fund — Authoritative Build & Deployment Mapping

**Established:** 2026-08-24
**Purpose:** Preserve the verified relationship between the Base44-origin application, the active Interplanetary Fund build, Convex, Vercel, GitHub Pages, and the legacy/reference repositories so future agents do not attach services to the wrong repository.

## Authoritative conclusion

**Vercel belongs to `interplanetarysister/InterplanetaryFund` for the active web application. It does NOT belong to `interplanetary-fund2` merely because `interplanetary-fund2` contains the Base44 frontend.**

The prior assumption that Vercel should pair directly with `interplanetary-fund2` is superseded by the verified build report and current architecture.

## Build map

| Layer | Authoritative location | Role | Deployment/relationship |
|---|---|---|---|
| Active application | `interplanetarysister/InterplanetaryFund` | React + Vite full-stack application | Primary application source; Vercel deploys this repo from `main` |
| Web frontend | `InterplanetaryFund/src/` | React/Vite user-facing web UI | Served by Vercel; GitHub Pages is documented fallback |
| Backend | `InterplanetaryFund/convex/` | Convex functions, schema, data, protocol, agents, treasury | Deployed to Convex Cloud (`rosy-butterfly-2`) |
| Primary web hosting | Vercel | Production web hosting for the active Interplanetary Fund React/Vite build | Auto-deploys from `InterplanetaryFund` GitHub `main` |
| Fallback web hosting | GitHub Pages | Secondary web host | Existing fallback deployment from the same active repository |
| Mobile | Base44-origin APK / Capacitor build | Mobile application path | Base44 frontend/API integration is a mobile-specific path; not the Vercel pairing target |
| Base44 export/reference | `interplanetarysister/interplanetary-fund2` | Base44-origin/user-facing application repository retained as a source/reference artifact | Do not treat this repo as the authoritative Vercel deployment target without an explicit architecture change |
| Legacy/reference backend | `interplanetarysister/interplanetary-fund-backend` | Older/reference backend | Protected legacy/reference; not the active Vercel target |

## Verified evidence

`ARCHITECTURE.md` identifies the active repository as `interplanetarysister/InterplanetaryFund`, with React frontend, Convex backend, Capacitor mobile code, Vercel as the **Primary Web Host**, and GitHub Pages as the fallback. It also states that Vercel auto-deploys from GitHub and that the frontend uses `VITE_CONVEX_URL`. 

`AUDIT_REPORT.md` records that the active Interplanetary Fund build had a passing Vite build, deployed Convex deployment `rosy-butterfly-2`, GitHub `main` deployment, and **Vercel auto-deploy from GitHub main**.

`package.json` independently confirms that `InterplanetaryFund` is a full-stack React + Vite + Convex application and contains the Vite build and Convex deployment commands.

## Runtime flow

```text
User
  |
  v
Vercel (primary web host)
  |
  v
React/Vite frontend in InterplanetaryFund
  |
  | Convex client / VITE_CONVEX_URL
  v
Convex Cloud: rosy-butterfly-2.convex.cloud
  |
  +-- user/campaign data
  +-- donations/treasury
  +-- protocol enforcement
  +-- agents
  +-- external platform sync
  +-- notifications/activity
```

### Mobile-specific path

```text
Base44-origin mobile frontend / Capacitor APK
  |
  v
Base44 app/backend integration path
  |
  v
Convex REST/API integration
  |
  v
Convex Cloud
```

This mobile path does not change the primary Vercel pairing: **Vercel remains paired with the active `InterplanetaryFund` repository.**

## Agent rule

When deciding where to deploy, connect, or configure Vercel for Interplanetary Fund:

1. Use `interplanetarysister/InterplanetaryFund` as the authoritative active application repository.
2. Deploy the React/Vite web application from its `main` branch through Vercel.
3. Treat Convex as the backend/data runtime for the active application.
4. Treat `interplanetary-fund2` as the Base44-origin/reference application repository unless a later architecture record explicitly changes that role.
5. Treat `interplanetary-fund-backend` as protected legacy/reference infrastructure; do not silently substitute it for the active Convex backend.
6. If a proposed change conflicts with this mapping, inspect the current architecture/audit records before changing deployment relationships.

## Source records

- `ARCHITECTURE.md` — active system architecture and deployment diagram.
- `AUDIT_REPORT.md` — schematic proof audit and deployment status.
- `base44-app-schema.json` — Base44 application schema/reference.
- `package.json` — active React/Vite/Convex build configuration.

## Status

**Authoritative build mapping archived in this repository.**

Future agents should update this file when the deployment architecture intentionally changes, rather than creating conflicting repository/service mappings.
