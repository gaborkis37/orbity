import type { SatelliteMeta } from '@orbity/shared';

export type SearchShortcut =
  | { kind: 'group'; group: 'starlink'; label: string }
  | { kind: 'satellite'; noradId: 25544; label: string };

const ISS_ALIASES = new Set(['iss', 'iss (zarya)', 'international space station']);

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function searchShortcut(query: string): SearchShortcut | null {
  const normalized = normalizeSearchQuery(query);
  if (normalized === 'starlink') {
    return { kind: 'group', group: 'starlink', label: 'Show all Starlink satellites' };
  }
  if (ISS_ALIASES.has(normalized)) {
    return { kind: 'satellite', noradId: 25544, label: 'ISS (ZARYA)' };
  }
  return null;
}

/** Small session cache: repeated typeahead queries should not hit the API again. */
export class SearchResultCache {
  private readonly entries = new Map<string, SatelliteMeta[]>();

  get(query: string): SatelliteMeta[] | undefined {
    return this.entries.get(normalizeSearchQuery(query));
  }

  set(query: string, results: SatelliteMeta[]): void {
    const key = normalizeSearchQuery(query);
    this.entries.delete(key);
    this.entries.set(key, results);
    if (this.entries.size > 50) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest) this.entries.delete(oldest);
    }
  }
}
