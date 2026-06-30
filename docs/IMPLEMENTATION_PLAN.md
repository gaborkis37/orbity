# Orbital Visualizer — Implementation Plan

A real-time 3D satellite tracker (Starlink, ISS, LEO objects) built with Cesium, Next.js, and NestJS in a monorepo, designed to scale to mobile (Expo) and to other solar-system bodies later.

This document is written to be handed to Claude Code agents. Each **Task** is independently assignable, has explicit **deliverables** and **acceptance criteria**, and lists its **dependencies** (which earlier tasks must be done first). Work the phases in order; within a phase, tasks marked *(parallel-safe)* can be done concurrently.

---

## 0. Architectural decisions (context for all agents)

- **Data model:** Never fetch live positions from an API. Fetch *orbital elements* (OMM/JSON from CelesTrak) a few times per day, cache them server-side, serve them in bulk to the client, and compute positions in the browser with SGP4 (`satellite.js`). This is the single most important design fact.
- **Format:** Use CelesTrak's `FORMAT=json` (OMM keywords), **not** legacy TLE text. The 5-digit NORAD catalog overflowed in mid-2026; TLE parsing is a dead end. OMM JSON handles 9-digit IDs.
- **Rate limits:** CelesTrak updates at most every 2 hours and firewalls IPs that produce 50 HTTP errors in 2 hours. The browser must NEVER call CelesTrak directly — always go through our cached backend.
- **Rendering:** CesiumJS via Resium (React bindings). Chosen for accurate ECEF/geospatial coordinates and a clear path to Moon/Mars later.
- **Performance rule:** All satellites render as primitives in as few draw calls as possible (Cesium `PointPrimitiveCollection`), and SGP4 propagation runs in a Web Worker, never on the main thread.
- **Repo shape:** monorepo with `apps/web` (Next.js → Vercel), `apps/api` (NestJS → Railway/Render, liftable to GCP Cloud Run), `packages/shared` (TypeScript types + propagation helpers reused by web, api, and future mobile).

### Key data endpoints (reference)
- All Starlink: `https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json`
- Stations (ISS, Tiangong): `?GROUP=stations&FORMAT=json`
- Everything active (~30k): `?GROUP=active&FORMAT=json`
- Single object by NORAD id: `?CATNR=25544&FORMAT=json` (25544 = ISS)
- Other useful groups: `gps-ops`, `galileo`, `oneweb`, `iridium-NEXT`, `noaa`, `weather`, `science`, `geo`

### Tech versions to pin
- Node 20 LTS, pnpm (workspace manager)
- Next.js (App Router, TypeScript, React 18+)
- NestJS 10+
- `cesium` + `resium`
- `satellite.js` for SGP4
- Redis (Upstash serverless) for the element cache
- Sentry + PostHog for observability

---

## Phase 1 — Foundation

### Task 1.1 — Monorepo scaffold
**Dependencies:** none
**Deliverables:**
- pnpm workspace with `apps/web`, `apps/api`, `packages/shared`.
- Root `package.json` with workspace scripts (`dev`, `build`, `lint`, `typecheck`).
- Shared `tsconfig` base extended by each package; ESLint + Prettier configured at root.
- `packages/shared` exports a stub type and is importable from both apps.
- `.env.example` files for web and api.
- README explaining repo layout and how to run each app.

**Acceptance criteria:**
- `pnpm install` at root succeeds.
- `pnpm --filter web dev` and `pnpm --filter api dev` both start.
- `packages/shared` can be imported from `apps/web` and `apps/api` with no type errors.

### Task 1.2 — Shared domain types and propagation helpers *(parallel-safe after 1.1)*
**Dependencies:** 1.1
**Deliverables (in `packages/shared`):**
- TypeScript interfaces: `OmmRecord` (raw CelesTrak OMM fields), `SatelliteMeta` (normalized: noradId, name, group, intlDes, objectType), `SatelliteState` (lat, lon, altKm, velocityKmS, eciPosition, eciVelocity, timestamp).
- `propagate(omm, date): SatelliteState` wrapping `satellite.js` (`twoline2satrec`/OMM init → `propagate` → `eciToGeodetic`), including velocity magnitude.
- `lookAngles(observer, omm, date)` returning azimuth, elevation, range (for pass prediction + AR later).
- `normalizeOmm(raw): { meta, satrec }` parser.
- Unit tests: propagate the ISS from a known fixed OMM at a fixed timestamp and assert lat/lon/alt/velocity fall within expected bounds.

**Acceptance criteria:**
- `pnpm --filter shared test` passes.
- ISS altitude computes to ~400–430 km and velocity to ~7.6–7.7 km/s for a sane element set.

---

## Phase 2 — Backend (data layer)

### Task 2.1 — NestJS skeleton + health + config
**Dependencies:** 1.1
**Deliverables:**
- NestJS app in `apps/api` with `/health` endpoint, config module reading env (Redis URL, CelesTrak base URL, refresh interval, CORS origins), global validation pipe, and structured logging.
- Dockerfile (multi-stage, production build) for Railway/Render/Cloud Run.
- CORS configured to allow the web app origin.

**Acceptance criteria:**
- `GET /health` returns 200 with `{ status: "ok", uptime }`.
- `docker build` produces a runnable image; container responds on `/health`.

### Task 2.2 — CelesTrak ingestion + cache
**Dependencies:** 2.1, 1.2
**Deliverables:**
- An `IngestionService` that fetches configured CelesTrak groups (start with `stations`, `starlink`, `active`), parses OMM JSON, normalizes via `packages/shared`, and stores in Redis: per-group lists plus a `noradId → record` map and a lightweight search index (name + group + noradId).
- A scheduled job (NestJS `@Cron`) refreshing every 3–6 hours, with jitter, retry/backoff, and a "last successful refresh" timestamp. On CelesTrak failure, keep serving the last good cache (never wipe).
- Respect rate limits: never refresh more often than every 2 hours; one bulk request per group.
- Manual `POST /admin/refresh` (protected by an admin token) to trigger ingestion on demand.

**Acceptance criteria:**
- After first run, Redis holds Starlink + stations + active records with a refresh timestamp.
- Simulated CelesTrak outage (mock 500) leaves the previous cache intact and logs the failure.
- No code path lets a client request reach CelesTrak directly.

### Task 2.3 — Public API endpoints
**Dependencies:** 2.2
**Deliverables:**
- `GET /satellites?group=starlink` → array of `{ meta, omm }` for that group (bulk, gzip-compressed).
- `GET /satellites/:noradId` → single record + extended metadata.
- `GET /search?q=...` → typeahead results (matches name substring, group keyword like "starlink"/"iss"/"international space station", or NORAD id), capped and ranked.
- `GET /groups` → list of available groups with object counts and last-refresh time.
- All responses cacheable (ETag / Cache-Control) so Vercel/edge can sit in front.

**Acceptance criteria:**
- `GET /search?q=iss` returns the ISS as a top hit.
- `GET /search?q=starlink` returns Starlink matches; `q=25544` returns the ISS by id.
- `GET /satellites?group=starlink` returns thousands of records as one compressed payload.
- Contract documented (OpenAPI/Swagger served at `/docs`).

---

## Phase 3 — Frontend (visualization)

### Task 3.1 — Next.js app shell + design system *(parallel-safe after 1.1)*
**Dependencies:** 1.1
**Deliverables:**
- Next.js App Router shell, dark space-themed UI, responsive layout reserving a full-viewport canvas with an overlay panel region (search top, info panel side/bottom).
- API client module pointing at `apps/api` (env-driven base URL), with typed responses from `packages/shared`.
- Loading and error states for data fetches.

**Acceptance criteria:**
- App builds and renders the shell with placeholder canvas and overlay regions.
- Lighthouse/responsive check: layout holds from mobile width to desktop.

### Task 3.2 — Cesium globe integration
**Dependencies:** 3.1
**Deliverables:**
- Resium `<Viewer>` mounted client-side only (no SSR for Cesium), Cesium static assets configured in Next, base imagery + lighting (sun position) enabled, default camera framing the globe.
- Remove Cesium's default widgets that we don't need; keep a clean look.
- Confirm the build correctly serves Cesium's Workers/Assets/Widgets.

**Acceptance criteria:**
- A lit, rotatable 3D Earth renders at 60fps on a typical laptop with no console asset errors.

### Task 3.3 — Propagation Web Worker + position pipeline
**Dependencies:** 3.2, 1.2, 2.3
**Deliverables:**
- A Web Worker that receives the bulk element set, runs `packages/shared` propagation for all objects, and posts back positions on a fixed tick (e.g. every 1s; configurable), using transferable typed arrays for performance.
- Main thread requests `GET /satellites?group=...`, hands elements to the worker, receives position buffers.
- Frame loop updates Cesium positions from the latest buffer.

**Acceptance criteria:**
- 6,000+ Starlink objects propagate and update every second with the main thread staying responsive (no jank when rotating the globe).
- Positions visually match a reference tracker (spot-check ISS ground track).

### Task 3.4 — Render satellites as instanced points
**Dependencies:** 3.3
**Deliverables:**
- Cesium `PointPrimitiveCollection` (or billboard collection) holding all active objects, colored/sized by group (e.g. ISS distinct, Starlink uniform).
- Efficient per-tick position update of the whole collection (no per-object entity churn).
- Toggle for showing all vs. a filtered subset.

**Acceptance criteria:**
- Entire active catalog (~tens of thousands) renders in few draw calls at interactive framerate.
- Switching filters does not recreate the whole scene from scratch.

---

## Phase 4 — Interaction

### Task 4.1 — Search + autocomplete
**Dependencies:** 3.4, 2.3
**Deliverables:**
- Top search bar with debounced typeahead hitting `GET /search`.
- Group shortcuts: typing "starlink" filters to the Starlink set; "ISS" / "international space station" resolves to NORAD 25544 and focuses it; free-text matches individual satellites.
- Selecting a result filters the rendered set and/or flies the camera to the object.

**Acceptance criteria:**
- "starlink" shows only Starlink; "iss" flies to and highlights the ISS; a specific satellite name selects just that object.
- Autocomplete feels instant (debounced, cached).

### Task 4.2 — Click-to-inspect info panel
**Dependencies:** 3.4
**Deliverables:**
- Clicking/tapping a point opens a panel showing: name, NORAD id, group, current altitude, velocity, lat/lon, and a live-updating readout (recomputed each tick).
- Graceful handling of overlapping points (pick nearest).

**Acceptance criteria:**
- Clicking the ISS shows live altitude (~400 km) and velocity (~7.66 km/s) updating each second.
- Panel closes/clears cleanly; works on touch.

### Task 4.3 — Orbit path rendering
**Dependencies:** 4.2
**Deliverables:**
- For the selected object, compute and draw its orbital path (propagate forward over one full period, build a Cesium polyline). Update or fade as time advances.
- Optionally show the ground track.

**Acceptance criteria:**
- Selecting the ISS draws a smooth closed orbit consistent with its ~92-minute period.
- Deselecting removes the orbit without leaking primitives.

---

## Phase 5 — Ship it

### Task 5.1 — Deploy web (Vercel) + api (Railway/Render)
**Dependencies:** Phase 2 + Phase 3 complete
**Deliverables:**
- `apps/web` deployed to Vercel; env vars wired to the deployed API URL.
- `apps/api` deployed to Railway or Render from its Dockerfile; Upstash Redis attached; scheduled ingestion confirmed running in prod.
- CORS locked to the Vercel domain. Document the exact steps so the api could later be redeployed to GCP Cloud Run + Cloud Scheduler with minimal change.

**Acceptance criteria:**
- Public URL renders the live globe with real cached data.
- Ingestion cron has run in production and timestamps advance.

### Task 5.2 — Observability
**Dependencies:** 5.1
**Deliverables:**
- Sentry in both apps (source maps for web, error capture for api).
- PostHog (or Vercel Analytics) for product events: search used, satellite selected, group filtered.
- Basic uptime check on `/health` and an alert if ingestion hasn't succeeded in N hours.

**Acceptance criteria:**
- A deliberately thrown error appears in Sentry from both apps.
- A stale-ingestion condition fires an alert.

---

## Phase 6 — Scale-out (later, after v1 is live)

These are scoped but intentionally deferred. Do not start until Phases 1–5 are shipped and stable.

### Task 6.1 — Pass prediction service (NestJS)
Compute upcoming visible passes for a given observer location and satellite (using `lookAngles` from `packages/shared` plus sunlit/observer-in-darkness checks). Expose `GET /passes?lat=&lon=&noradId=`. This is the backend foundation for notifications and is why the API is NestJS, not serverless.

### Task 6.2 — Accounts + saved satellites
Add Postgres (Supabase/Neon), auth, and per-user saved objects / notification preferences.

### Task 6.3 — Expo mobile app
New `apps/mobile` (Expo / React Native) reusing `packages/shared`. Cesium-for-mobile or a lighter native globe; reuse the same API.

### Task 6.4 — AR sighting mode (mobile)
Fuse device GPS + compass + accelerometer, compute the selected satellite's azimuth/elevation from `lookAngles`, overlay a marker on the camera feed (`expo-camera`), and trigger push notifications scheduled from the pass-prediction service. Hardest feature — depends on 6.1, 6.2, 6.3.

### Task 6.5 — Solar-system bodies
Extend the scene to Moon/Mars/planets. Cesium's accurate coordinate system was chosen partly for this; bring in ephemeris data (e.g. JPL Horizons / SPICE-derived) on a separate ingestion path.

---

## Suggested agent assignment order
1. Task 1.1 (blocks everything)
2. Then in parallel: 1.2, 2.1, 3.1
3. Then 2.2 → 2.3 (backend track) alongside 3.2 → 3.3 → 3.4 (frontend track)
4. Then 4.1, 4.2, 4.3 (interaction, mostly sequential)
5. Then 5.1 → 5.2 (ship)
6. Phase 6 only after a stable live v1.

## Definition of done for v1
A public URL shows a lit 3D Earth with the live satellite catalog; a user can search "starlink" to filter, type "ISS" to fly to the station, click any object to see live altitude/velocity, and view its orbit — all served from a cached backend that refreshes from CelesTrak on schedule, with errors and product events tracked.
