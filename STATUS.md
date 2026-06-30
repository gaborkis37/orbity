# Orbity — Build Status & Progress Tracker

> **This is the single source of truth for "where are we and what's next."**
> Read this file + [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) before starting any work.
> Agents: follow the protocol in [`CLAUDE.md`](CLAUDE.md). Keep this file updated as you go.

**Project:** Real-time 3D satellite tracker (Cesium + Next.js + NestJS monorepo).
**Last updated:** 2026-06-30 — _Task 3.1 (Next.js app shell + design system + typed API client) complete._
**Current phase:** Phase 2 (backend) + Phase 3 (frontend) in progress
**Overall progress:** 4 / 14 v1 tasks complete

---

## Status legend
| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🟡 | In progress (see Assignee) |
| 🔵 | In review (PR open, acceptance criteria being verified) |
| ✅ | Done (acceptance criteria met + merged) |
| 🚧 | Blocked (see Notes) |

---

## ▶️ Ready to start now (unblocked)
These tasks have all dependencies met. Claim one by setting it 🟡 + your name below.

- **Task 2.2 — CelesTrak ingestion + Redis cache** _(backend track; deps 2.1 ✅ + 1.2 ✅ met)_
- **Task 3.2 — Cesium globe via Resium** _(frontend track; deps 3.1 ✅ met — adds `cesium`/`resium`, client-only)_

_Backend track 2.2→2.3 and frontend track 3.2→3.3→3.4 can run in parallel._

---

## Task board

### Phase 1 — Foundation
| ID | Task | Status | Depends on | Assignee | Branch / PR | Notes |
|----|------|:------:|------------|----------|-------------|-------|
| 1.1 | Monorepo scaffold (pnpm workspace, web/api/shared, lint/tsconfig) | ✅ | — | Claude | initial commit | install/build/typecheck/dev all green |
| 1.2 | Shared domain types + SGP4 propagation helpers + tests | ✅ | 1.1 | Claude | (this commit) | OMM→TLE→SGP4; ISS 416km/7.66km/s; 9-digit id preserved; 8 tests pass |

### Phase 2 — Backend (data layer)
| ID | Task | Status | Depends on | Assignee | Branch / PR | Notes |
|----|------|:------:|------------|----------|-------------|-------|
| 2.1 | NestJS skeleton + /health + config + Dockerfile + CORS | ✅ | 1.1 | Claude | (uncommitted) | typed config+validation, pino logging, ValidationPipe; /health 200; docker image built & container serves /health |
| 2.2 | CelesTrak ingestion + Redis cache + scheduled refresh | ⬜ | 2.1, 1.2 | — | — | Never let client reach CelesTrak |
| 2.3 | Public API endpoints (/satellites, /search, /groups) + Swagger | ⬜ | 2.2 | — | — | gzip bulk; ETag/Cache-Control |

### Phase 3 — Frontend (visualization)
| ID | Task | Status | Depends on | Assignee | Branch / PR | Notes |
|----|------|:------:|------------|----------|-------------|-------|
| 3.1 | Next.js app shell + dark space UI + typed API client | ✅ | 1.1 | Claude | (uncommitted) | full-viewport globe placeholder + overlay HUD (search top, info panel side/bottom-sheet); CSS-var design tokens; typed `lib/api` client (env base URL, shared types); loading/error boundaries; live API status badge; lint/typecheck/build green, shell renders 200 |
| 3.2 | Cesium globe via Resium (client-only, assets wired) | ⬜ | 3.1 | — | — | No SSR for Cesium |
| 3.3 | Propagation Web Worker + position pipeline | ⬜ | 3.2, 1.2, 2.3 | — | — | Transferable typed arrays |
| 3.4 | Render satellites as instanced points (PointPrimitiveCollection) | ⬜ | 3.3 | — | — | Few draw calls; no entity churn |

### Phase 4 — Interaction
| ID | Task | Status | Depends on | Assignee | Branch / PR | Notes |
|----|------|:------:|------------|----------|-------------|-------|
| 4.1 | Search + autocomplete (debounced typeahead, group shortcuts) | ⬜ | 3.4, 2.3 | — | — | |
| 4.2 | Click-to-inspect live info panel | ⬜ | 3.4 | — | — | Pick nearest on overlap |
| 4.3 | Orbit path rendering for selected object | ⬜ | 4.2 | — | — | Clean up primitives on deselect |

### Phase 5 — Ship it
| ID | Task | Status | Depends on | Assignee | Branch / PR | Notes |
|----|------|:------:|------------|----------|-------------|-------|
| 5.1 | Deploy web (Vercel) + api (Railway/Render) + Upstash Redis | ⬜ | Ph2 + Ph3 | — | — | Lock CORS to Vercel domain |
| 5.2 | Observability (Sentry, PostHog/Analytics, uptime + stale-ingest alert) | ⬜ | 5.1 | — | — | |

### Phase 6 — Scale-out (DO NOT START until v1 is live & stable)
| ID | Task | Status | Depends on | Notes |
|----|------|:------:|------------|-------|
| 6.1 | Pass prediction service | ⬜ | v1 stable | Deferred |
| 6.2 | Accounts + saved satellites (Postgres) | ⬜ | v1 stable | Deferred |
| 6.3 | Expo mobile app | ⬜ | v1 stable | Deferred |
| 6.4 | AR sighting mode | ⬜ | 6.1, 6.2, 6.3 | Deferred |
| 6.5 | Solar-system bodies | ⬜ | v1 stable | Deferred |

---

## Critical-path & parallelization map
```
1.1  ─┬─► 1.2 ─────────────┐
      ├─► 2.1 ─► 2.2 ─► 2.3 ┼─► 3.3 ─► 3.4 ─┬─► 4.1
      └─► 3.1 ─► 3.2 ───────┘                ├─► 4.2 ─► 4.3
                                             ┘
   (Ph2 + Ph3 done) ─► 5.1 ─► 5.2  ✅ v1
```
- **Backend track:** 2.1 → 2.2 → 2.3
- **Frontend track:** 3.1 → 3.2 → 3.3 → 3.4  (3.3 also needs 1.2 + 2.3)
- These two tracks run **in parallel** after 1.1.

---

## 🚧 Blockers / open questions
_None yet._

<!-- Add as: **[BLOCKER] <task id>** — description — raised by <name> on <date> -->

---

## 📓 Changelog (append-only — newest first)
Each entry: date — task — what changed — who.

- **2026-06-30** — _3.1_ — Next.js app shell + dark "space" design system. Full-viewport globe canvas placeholder (`GlobeCanvas`, ready for Resium in 3.2) with a pointer-events-aware HUD overlay: brand mark + search bar (top), info panel (right on desktop / bottom sheet on mobile), and a live API connectivity badge. Design tokens as CSS custom properties in `globals.css`; components styled via CSS Modules (no new runtime deps → no lockfile churn). Typed API client in `apps/web/lib/api` (`api.health/satellites/groups/search`, `ApiError`, timeout + abort) reading an env-driven base URL (`NEXT_PUBLIC_API_BASE_URL`); response contract types built on `@orbity/shared` (`SatelliteRecord`, etc.) — these define what 2.2/2.3 will serve. Route-level `loading.tsx`/`error.tsx` boundaries; richer `metadata`/`viewport`. Verified: lint + typecheck + `next build` green (page prerenders static), prod server returns 200 with all shell regions in SSR markup. **Not committed** (per request). — Claude
- **2026-06-30** — _2.1_ — NestJS API skeleton: typed `ConfigModule` with class-validator env validation (`PORT`, `CORS_ORIGINS`, `REDIS_URL`, `CELESTRAK_BASE_URL`, `REFRESH_INTERVAL_HOURS`, `ADMIN_TOKEN`), structured logging via `nestjs-pino` (pretty in dev, JSON in prod), global `ValidationPipe`, CORS locked to configured origins, shutdown hooks, and a `GET /health` → `{status:"ok",uptime}` endpoint. Multi-stage `apps/api/Dockerfile` (pnpm monorepo aware) + root `.dockerignore`. Verified: `/health` 200 locally and inside a built container (573 MB); CORS header present; logs structured. **Not committed** (per request). — Claude
- **2026-06-30** — _1.2_ — Shared domain types (`OmmRecord`, `SatelliteMeta`, `SatelliteState`, `Observer`, `LookAngle`, `Vec3`) + SGP4 helpers (`normalizeOmm`, `propagate`, `propagateSatrec`, `lookAngles`) in `packages/shared`, wrapping `satellite.js`. satellite.js v5 is TLE-only, so `normalizeOmm` synthesizes a column-exact TLE with a throwaway satnum while the real (up-to-9-digit) NORAD id is kept in `SatelliteMeta` — verified by test. 8 vitest tests pass; ISS @ epoch computes 416.4 km / 7.663 km/s. Removed the 1.1 stub and updated the web/api demos accordingly. — Claude
- **2026-06-30** — _1.1_ — Monorepo scaffold landed: pnpm workspace (`apps/web` Next 14, `apps/api` NestJS 10, `packages/shared`), root tsconfig base + ESLint + Prettier, `.env.example` for web & api, README. `@orbity/shared` builds to dist via root `prepare`; imports verified in both apps. `pnpm install/build/typecheck` green; both dev servers return 200. — Claude
- **2026-06-30** — _setup_ — Created tracker (`STATUS.md`), agent protocol (`CLAUDE.md`), and copied spec to `docs/IMPLEMENTATION_PLAN.md`. Repo still empty of code. — Claude

---

## Environment / infra checklist
Track what's actually provisioned (separate from code).

| Item | Status | Notes |
|------|:------:|-------|
| pnpm workspace | ✅ | created in 1.1 (pnpm 9, Node 20) |
| Upstash Redis (dev) | ⬜ | needed for 2.2 |
| Upstash Redis (prod) | ⬜ | needed for 5.1 |
| Vercel project (web) | ⬜ | 5.1 |
| Railway/Render service (api) | ⬜ | 5.1 |
| CelesTrak access verified | ⬜ | 2.2 — respect 2h rate limit |
| Sentry projects (web + api) | ⬜ | 5.2 |
| PostHog / Vercel Analytics | ⬜ | 5.2 |
| Admin token for /admin/refresh | ⬜ | 2.2 |
