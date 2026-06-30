import type { OmmRecord, SatelliteMeta } from '@orbity/shared';

/**
 * One catalog object as stored and served: normalized metadata plus its latest
 * OMM element set. Mirrors the wire contract the web client already expects
 * (`apps/web/lib/api/types.ts`); promoted to `@orbity/shared` if a third consumer
 * appears.
 */
export interface SatelliteRecord {
  meta: SatelliteMeta;
  omm: OmmRecord;
}

/** Lightweight entry powering name/id/group typeahead (Task 2.3 `/search`). */
export interface SearchIndexEntry {
  noradId: number;
  name: string;
  group?: string;
}

/** Outcome of refreshing a single CelesTrak group. */
export interface GroupRefreshResult {
  group: string;
  ok: boolean;
  /** Records written on success. */
  count: number;
  /** Error message on failure (cache for this group is left untouched). */
  error?: string;
}

/** Summary of one ingestion cycle. */
export interface RefreshResult {
  /** True when the cycle was short-circuited by the 2 h rate-limit floor. */
  skipped: boolean;
  /** Reason for a skip (e.g. "refreshed 41m ago"). */
  reason?: string;
  groups: GroupRefreshResult[];
  /** Total records across all groups after the cycle. */
  total: number;
  /** Last successful refresh time (epoch ms), or null if never. */
  lastRefresh: number | null;
}
