# Orbity — Agent Operating Guide

You are working on **Orbity**, a real-time 3D satellite tracker. This file tells any agent how to pick up work safely. Read it fully before touching code.

## The three documents
1. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — the **spec**. Tasks, deliverables, acceptance criteria, architecture decisions. Treat as authoritative.
2. [`STATUS.md`](STATUS.md) — the **live tracker**. What's done, in progress, blocked, and next. Always current.
3. This file (`CLAUDE.md`) — **how to work**. Conventions + the pick-up protocol.

## How to pick up work (the protocol)
1. **Read** `STATUS.md` → "Ready to start now". Pick a task whose dependencies are all ✅.
2. **Claim it:** in `STATUS.md`, set the task to 🟡, put your name in Assignee, and add the branch name. Commit this claim first so others see it.
3. **Branch:** `git checkout -b <area>/<task-id>-<slug>` — e.g. `feat/2.2-celestrak-ingestion`. Never commit feature work directly to `main`.
4. **Build** strictly to the task's **Deliverables**. Don't scope-creep into other tasks.
5. **Verify** every **Acceptance criterion** in the spec. A task is not done until all pass.
6. **Update** `STATUS.md`: set ✅, add the PR link, add a Changelog entry, tick any Environment/infra items you provisioned. Update "Ready to start now" with whatever your task just unblocked.
7. **Open a PR** to `main`. Don't merge your own task without the acceptance criteria demonstrably met.

If a task is bigger than one sitting, leave it 🟡 with a short "where I left off" note in the task's Notes cell so the next agent can resume.

## Non-negotiable architecture rules (from the spec)
- **Never** call CelesTrak from the browser. Client → our cached backend → Redis. Backend refreshes ≤ every 2h.
- Use CelesTrak **`FORMAT=json` (OMM)**, never legacy TLE text. NORAD ids can be 9 digits now.
- SGP4 propagation runs in a **Web Worker**, never the main thread.
- Satellites render via Cesium **`PointPrimitiveCollection`** (few draw calls), not per-object entities.
- Cesium/Resium is **client-only** (no SSR).
- Shared types + propagation live in `packages/shared` and are reused by web, api, and future mobile.

## Tech to pin
Node 20 LTS · pnpm workspaces · Next.js App Router + TS + React 18 · NestJS 10+ · `cesium` + `resium` · `satellite.js` · Upstash Redis · Sentry + PostHog.

## Repo layout (target)
```
apps/web        Next.js → Vercel
apps/api        NestJS → Railway/Render (liftable to Cloud Run)
packages/shared TS types + SGP4 propagation helpers
docs/           spec & supporting docs
STATUS.md       live progress tracker
```

## Conventions
- **Commits:** Conventional Commits, scoped by task id where useful — `feat(api): 2.2 celestrak ingestion + redis cache`.
- **Branches:** `feat|fix|chore/<task-id>-<slug>`.
- **TypeScript:** strict mode everywhere; no `any` in `packages/shared`.
- **Before pushing:** `pnpm lint && pnpm typecheck && pnpm build` must pass for affected packages; run the package's tests.
- **Env:** never commit secrets; keep `.env.example` current when you add a variable.

## Definition of done for v1
Public URL shows a lit 3D Earth with the live catalog; search "starlink" filters, "ISS" flies to the station, clicking any object shows live altitude/velocity, and its orbit renders — all from a cached backend that refreshes from CelesTrak on schedule, with errors + product events tracked.
