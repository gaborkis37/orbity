/**
 * Wire contract for the Orbity API.
 *
 * These shapes describe what `apps/api` will serve (Tasks 2.2 / 2.3). They are
 * built on the shared domain types so the browser, the API, and the propagation
 * worker all speak the same language. When the public endpoints land, the API
 * should be made to satisfy these types (or these types updated to match).
 */
import type { OmmRecord, SatelliteMeta } from '@orbity/shared';

/** One catalog object: metadata plus its latest orbital element set. */
export interface SatelliteRecord {
  meta: SatelliteMeta;
  omm: OmmRecord;
}

/** Bulk element set returned by `GET /satellites`. */
export interface SatellitesResponse {
  /** When the underlying CelesTrak data was last refreshed (ISO 8601). */
  updatedAt: string | null;
  count: number;
  satellites: SatelliteRecord[];
}

/** A selectable CelesTrak group (e.g. "starlink", "active"). */
export interface SatelliteGroup {
  id: string;
  label: string;
  count: number;
  lastRefresh: string | null;
}

/** Response of `GET /groups`. */
export interface GroupsResponse {
  groups: SatelliteGroup[];
}

/** Response of `GET /search?q=...` — lightweight metadata for typeahead. */
export interface SearchResponse {
  query: string;
  results: SatelliteMeta[];
}

/** Response of `GET /health`. */
export interface HealthResponse {
  status: 'ok';
  uptime: number;
}
