import { Inject, Injectable } from '@nestjs/common';
import { CACHE_STORE, CacheStore } from '../cache/cache.store';
import { SatelliteRecord, SearchIndexEntry } from './ingestion.types';

/** Redis key namespace for everything this service owns. */
const KEY = {
  group: (group: string) => `orbity:group:${group}`,
  byId: 'orbity:byId',
  search: 'orbity:search',
  lastRefresh: 'orbity:meta:lastRefresh',
} as const;

/**
 * Typed read/write access to the satellite cache, hiding key layout and JSON
 * (de)serialization from the rest of the app. Storage shape:
 *   - `orbity:group:<g>`  → JSON `SatelliteRecord[]` (one bulk blob per group)
 *   - `orbity:byId`       → hash, field = noradId, value = JSON `SatelliteRecord`
 *   - `orbity:search`     → JSON `SearchIndexEntry[]` (deduped, for typeahead)
 *   - `orbity:meta:lastRefresh` → epoch-ms string
 */
@Injectable()
export class SatelliteCacheRepository {
  constructor(@Inject(CACHE_STORE) private readonly store: CacheStore) {}

  /** Overwrite a single group's records (only called after a successful fetch). */
  async writeGroup(group: string, records: SatelliteRecord[]): Promise<void> {
    await this.store.set(KEY.group(group), JSON.stringify(records));
  }

  /** Read a group's records (empty array if the group has never been ingested). */
  async readGroup(group: string): Promise<SatelliteRecord[]> {
    const raw = await this.store.get(KEY.group(group));
    if (!raw) return [];
    return JSON.parse(raw) as SatelliteRecord[];
  }

  /**
   * Rebuild the cross-group aggregates (`byId` hash + `search` index) from
   * whatever each group currently holds in cache — including groups that were
   * not refreshed this cycle — so a partial failure never drops good data.
   * Earlier groups win on duplicate noradIds, so pass the most specific groups
   * first (e.g. `starlink` before `active`).
   */
  async rebuildAggregates(groups: string[]): Promise<number> {
    const byId: Record<string, string> = {};
    const search: SearchIndexEntry[] = [];
    const seen = new Set<number>();

    for (const group of groups) {
      const records = await this.readGroup(group);
      for (const record of records) {
        const { noradId, name } = record.meta;
        if (seen.has(noradId)) continue;
        seen.add(noradId);
        byId[String(noradId)] = JSON.stringify(record);
        search.push({ noradId, name, group: record.meta.group });
      }
    }

    await this.store.replaceHash(KEY.byId, byId);
    await this.store.set(KEY.search, JSON.stringify(search));
    return seen.size;
  }

  /** Look up a single object by NORAD id (O(1) hash read). */
  async getById(noradId: number): Promise<SatelliteRecord | null> {
    const raw = await this.store.hget(KEY.byId, String(noradId));
    return raw ? (JSON.parse(raw) as SatelliteRecord) : null;
  }

  /** Total distinct objects currently indexed. */
  async count(): Promise<number> {
    return this.store.hlen(KEY.byId);
  }

  /** Case-insensitive name/id search over the lightweight index. */
  async search(query: string, limit = 20): Promise<SearchIndexEntry[]> {
    const index = await this.readSearchIndex();
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: SearchIndexEntry[] = [];
    for (const entry of index) {
      if (entry.name.toLowerCase().includes(q) || String(entry.noradId).includes(q)) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  /** Read the lightweight index for ranked public search. */
  async readSearchIndex(): Promise<SearchIndexEntry[]> {
    const raw = await this.store.get(KEY.search);
    return raw ? (JSON.parse(raw) as SearchIndexEntry[]) : [];
  }

  async setLastRefresh(epochMs: number): Promise<void> {
    await this.store.set(KEY.lastRefresh, String(epochMs));
  }

  async getLastRefresh(): Promise<number | null> {
    const raw = await this.store.get(KEY.lastRefresh);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
