# Orbity

Real-time 3D satellite tracker (Starlink, ISS, LEO objects) built with **Cesium**, **Next.js**, and **NestJS** in a pnpm monorepo — designed to scale to mobile (Expo) and other solar-system bodies later.

> **How it works (the one design fact that matters):** the browser never fetches live positions. The backend pulls *orbital elements* (OMM JSON from CelesTrak) a few times a day, caches them in Redis, and serves them in bulk. The client computes positions with SGP4 (`satellite.js`) in a Web Worker. See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Repo layout

```
apps/
  web/        Next.js (App Router) → Vercel.  The 3D globe + UI.
  api/        NestJS → Railway/Render.  CelesTrak ingestion + cached API.
packages/
  shared/     TypeScript types + SGP4 propagation helpers, reused by web, api, and future mobile.
docs/
  IMPLEMENTATION_PLAN.md   Full spec: tasks, deliverables, acceptance criteria.
STATUS.md     Live progress tracker — what's done / in progress / next.
CLAUDE.md     How agents pick up and hand off work.
```

`apps/*` depend on `@orbity/shared` via the `workspace:*` protocol. A root `prepare` script builds `@orbity/shared` after `pnpm install`, so the apps always have its compiled output available.

## Prerequisites

- **Node 20 LTS**
- **pnpm 9** (`corepack enable && corepack prepare pnpm@9 --activate`)

## Getting started

```bash
pnpm install          # installs all workspaces; builds @orbity/shared
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

### Run everything (parallel)

```bash
pnpm dev
```

### Run one app

```bash
pnpm --filter @orbity/web dev    # Next.js on http://localhost:3000
pnpm --filter @orbity/api dev    # NestJS on http://localhost:4000
```

## Workspace scripts (run from root)

| Script | What it does |
|--------|--------------|
| `pnpm dev` | Runs `dev` in all packages in parallel |
| `pnpm build` | Builds all packages in dependency order (shared first) |
| `pnpm lint` | Lints all packages |
| `pnpm typecheck` | Type-checks all packages |
| `pnpm test` | Runs tests in all packages |
| `pnpm format` | Formats the repo with Prettier |

## Contributing / picking up work

Read [`STATUS.md`](STATUS.md) for the task board and [`CLAUDE.md`](CLAUDE.md) for the workflow (claim a task → branch → build to acceptance criteria → update the tracker → PR).
