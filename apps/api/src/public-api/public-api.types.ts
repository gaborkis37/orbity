import type { OmmRecord, SatelliteMeta } from '@orbity/shared';
import type { SatelliteRecord } from '../ingestion/ingestion.types';

export interface SatellitesResponse {
  updatedAt: string | null;
  count: number;
  satellites: SatelliteRecord[];
}

export interface SatelliteDetailResponse extends SatelliteRecord {
  updatedAt: string | null;
}

export interface SatelliteGroup {
  id: string;
  label: string;
  count: number;
  lastRefresh: string | null;
}

export interface GroupsResponse {
  groups: SatelliteGroup[];
}

export interface SearchResponse {
  query: string;
  results: SatelliteMeta[];
}

// Keep the domain types visible in generated declarations for API consumers.
export type PublicSatelliteRecord = { meta: SatelliteMeta; omm: OmmRecord };
