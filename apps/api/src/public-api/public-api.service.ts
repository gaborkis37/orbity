import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SatelliteMeta } from '@orbity/shared';
import type { ConfigTree } from '../config/configuration';
import type { SearchIndexEntry } from '../ingestion/ingestion.types';
import { SatelliteCacheRepository } from '../ingestion/satellite-cache.repository';
import type {
  GroupsResponse,
  SatelliteDetailResponse,
  SatellitesResponse,
  SearchResponse,
} from './public-api.types';

const SEARCH_ALIASES: Readonly<Record<string, number>> = {
  iss: 25544,
  'international space station': 25544,
};

@Injectable()
export class PublicApiService {
  private readonly groups: string[];

  constructor(
    config: ConfigService<ConfigTree, true>,
    private readonly repository: SatelliteCacheRepository,
  ) {
    this.groups = config.getOrThrow('app', { infer: true }).celestrakGroups;
  }

  async satellites(requestedGroup?: string): Promise<SatellitesResponse> {
    const group = (requestedGroup ?? (this.groups.includes('active') ? 'active' : this.groups[0]))
      .trim()
      .toLowerCase();
    if (!this.groups.includes(group)) {
      throw new BadRequestException(
        `Unknown group "${group}". Available groups: ${this.groups.join(', ')}`,
      );
    }

    const [satellites, lastRefresh] = await Promise.all([
      this.repository.readGroup(group),
      this.repository.getLastRefresh(),
    ]);
    return { updatedAt: toIso(lastRefresh), count: satellites.length, satellites };
  }

  async satellite(noradId: number): Promise<SatelliteDetailResponse> {
    const [record, lastRefresh] = await Promise.all([
      this.repository.getById(noradId),
      this.repository.getLastRefresh(),
    ]);
    if (!record) throw new NotFoundException(`Satellite ${noradId} was not found`);
    return { ...record, updatedAt: toIso(lastRefresh) };
  }

  async groupsSummary(): Promise<GroupsResponse> {
    const [recordsByGroup, lastRefresh] = await Promise.all([
      Promise.all(this.groups.map((group) => this.repository.readGroup(group))),
      this.repository.getLastRefresh(),
    ]);
    const refreshedAt = toIso(lastRefresh);
    return {
      groups: this.groups.map((id, index) => ({
        id,
        label: groupLabel(id),
        count: recordsByGroup[index].length,
        lastRefresh: refreshedAt,
      })),
    };
  }

  async search(rawQuery: string, limit: number): Promise<SearchResponse> {
    const query = normalize(rawQuery);
    if (!query) return { query, results: [] };

    const index = await this.repository.readSearchIndex();
    const ranked = index
      .map((entry) => ({ entry, score: searchScore(entry, query) }))
      .filter((candidate): candidate is { entry: SearchIndexEntry; score: number } =>
        Number.isFinite(candidate.score),
      )
      .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
      .slice(0, limit);

    const records = await Promise.all(
      ranked.map(({ entry }) => this.repository.getById(entry.noradId)),
    );
    const results = records.flatMap((record): SatelliteMeta[] => (record ? [record.meta] : []));
    return { query, results };
  }
}

function searchScore(entry: SearchIndexEntry, query: string): number {
  const name = normalize(entry.name);
  const group = normalize(entry.group ?? '');
  const id = String(entry.noradId);

  if (SEARCH_ALIASES[query] === entry.noradId) return 0;
  if (id === query) return 1;
  if (name === query) return 2;
  if (group === query) return 3;
  if (name.startsWith(query)) return 4;
  if (group.startsWith(query)) return 5;
  if (name.includes(query)) return 6;
  if (id.includes(query)) return 7;
  if (group.includes(query)) return 8;
  return Number.POSITIVE_INFINITY;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toIso(epochMs: number | null): string | null {
  return epochMs === null ? null : new Date(epochMs).toISOString();
}

function groupLabel(group: string): string {
  return group
    .split('-')
    .map((part) => (part === 'gps' ? 'GPS' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}
