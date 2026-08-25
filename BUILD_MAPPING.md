# Interplanetary Fund — Authoritative Build & Deployment Mapping

**Established:** 2026-08-24  
**Purpose:** Preserve the verified relationship between the Base44-origin application, the active Interplanetary Fund build, Convex, Vercel, GitHub Pages, and the legacy/reference repositories so future agents do not attach services to the wrong repository.

## Authoritative conclusion

**The active Interplanetary Fund web application is React + Vite, not Next.js.** There is no Next.js application framework in the active build. Do not describe, configure, or migrate the active web application as a Next.js app unless a future architecture decision explicitly changes the framework.

**Vercel belongs to `interplanetarysister/InterplanetaryFund` for the active web application. It does NOT belong to `interplanetary-fund2` merely because `interplanetary-fund2` contains the Base44 frontend.**

## Verified frontend stack

- UI framework: **React 18** (`react`, `react-dom`)
- Build/dev framework: **Vite 5** (`vite`, `@vitejs/plugin-react`)
- Routing in the active app: React application routing; do not infer Next.js App Router or Pages Router
- Backend/runtime: **Convex**
- Mobile wrapper: **Capacitor**
- Styling: Tailwind CSS
- Production web build output: `dist/`

The authoritative evidence is the active repository `package.json`, whose scripts use `vite`/`vite build` and whose dependencies include React, React DOM, and `@vitejs/plugin-react`. It does not declare `next`.

## Build map

| Layer | Authoritative location | Role | Deployment/relationship |
|---|---|---|---|
| Active application | `interplanetarysister/InterplanetaryFund` | React + Vite full-stack application | Primary application source; Vercel deploys this repo from `main` |
| Web frontend | `InterplanetaryFund/src/` | React/Vite user-facing web UI | Served by Vercel; GitHub Pages is documented fallback |
| Backend | `InterplanetaryFund/convex/` | Convex functions, schema, data, protocol, agents, treasury | Deployed to Convex Cloud (`rosy-butterfly-2`) |
| Primary web hosting | Vercel | Production web hosting for the active Interplanetary Fund React/Vite build | Auto-deploys from `InterplanetaryFund` GitHub `main` |
| Fallback web hosting | GitHub Pages | Secondary web host | Existing fallback deployment from the same active repository |
| Mobile | Base44-origin APK / Capacitor build | Mobile application path | Base44 frontend/API integration is a mobile-specific path; not the Vercel pairing target |
| Base44 export/reference | `interplanetarysister/interplanetary-fund2` | Base44-origin/user-facing application repository retained as a source/reference artifact | React + Vite/Base44 application; do not describe it as Next.js |
| Legacy/reference backend | `interplanetarysister/interplanetary-fund-backend` | Older/reference backend | Protected legacy/reference; not the active Vercel target |

## Next.js correction rule

The following is now an explicit project-wide documentation rule:

> **Interplanetary Fund's current web applications use React with Vite. They are not Next.js applications.**

`next-themes` appearing in `interplanetary-fund2/package.json` is a React-compatible theme utility and is **not** evidence that the application uses the Next.js framework. The presence of that package must not cause agents to label the repository as Next.js.

Agents must distinguish:

- **React** = UI library/framework used by these applications.
- **Vite** = frontend build/dev tooling used by the active web applications.
- **Next.js** = a separate React framework that is not currently the project's web application framework.

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
6. Never infer Next.js from React usage, React Router, `next-themes`, or generic React ecosystem packages.
7. If a proposed change conflicts with this mapping, inspect the current architecture/audit records before changing deployment relationships.

## Source records

- `ARCHITECTURE.md` — active system architecture and deployment diagram.
- `AUDIT_REPORT.md` — schematic proof audit and deployment status.
- `base44-app-schema.json` — Base44 application schema/reference.
- `package.json` — active React/Vite/Convex build configuration.

## Status

**Authoritative build mapping archived in this repository.**

Future agents should update this file when the deployment architecture intentionally changes, rather than creating conflicting repository/service mappings.
