import type { ConfigService } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { OmmRecord } from '@orbity/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore } from '../cache/memory-cache.store';
import type { ConfigTree } from '../config/configuration';
import type { CelestrakClient } from './celestrak.client';
import { CelestrakError } from './celestrak.client';
import { IngestionService } from './ingestion.service';
import { SatelliteCacheRepository } from './satellite-cache.repository';

/** A propagatable ISS-like OMM record (real-ish elements so SGP4 init succeeds). */
function ommFixture(noradId: number, name: string): OmmRecord {
  return {
    OBJECT_NAME: name,
    OBJECT_ID: '1998-067A',
    EPOCH: '2026-06-30T12:00:00.000000',
    MEAN_MOTION: 15.5,
    ECCENTRICITY: 0.0006,
    INCLINATION: 51.64,
    RA_OF_ASC_NODE: 247.46,
    ARG_OF_PERICENTER: 130.5,
    MEAN_ANOMALY: 325.0,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: noradId,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 40000,
    BSTAR: 0.0001,
    MEAN_MOTION_DOT: 0.00001,
    MEAN_MOTION_DDOT: 0,
  };
}

/**
 * Build an IngestionService over a real in-memory cache with a controllable
 * CelesTrak client and an inert scheduler (we drive `refresh()` directly).
 */
function makeService(fetchGroup: CelestrakClient['fetchGroup']) {
  const store = new MemoryCacheStore();
  const repo = new SatelliteCacheRepository(store);

  const config = {
    getOrThrow: () => ({ celestrakGroups: ['stations'], refreshIntervalHours: 6 }),
  } as unknown as ConfigService<ConfigTree, true>;

  const celestrak = { fetchGroup: vi.fn(fetchGroup) } as unknown as CelestrakClient;
  const scheduler = {
    addTimeout: vi.fn(),
    deleteTimeout: vi.fn(),
    doesExist: vi.fn().mockReturnValue(false),
  } as unknown as SchedulerRegistry;

  const service = new IngestionService(config, celestrak, repo, scheduler);
  return { service, repo, celestrak };
}

describe('IngestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches a group on a successful refresh and records the timestamp', async () => {
    const { service, repo } = makeService(async () => [
      ommFixture(25544, 'ISS (ZARYA)'),
      ommFixture(999999999, 'BIG-CATALOG-ID'), // 9-digit NORAD id is preserved
    ]);

    const result = await service.refresh();

    expect(result.skipped).toBe(false);
    expect(result.total).toBe(2);
    expect(result.groups).toEqual([{ group: 'stations', ok: true, count: 2 }]);
    expect(await repo.getLastRefresh()).not.toBeNull();
    expect((await repo.getById(999999999))?.meta.noradId).toBe(999999999);
    expect((await repo.readGroup('stations')).length).toBe(2);
  });

  it('keeps the previous cache intact when CelesTrak fails (simulated 500)', async () => {
    // First: a healthy refresh seeds the cache.
    const fetchGroup = vi
      .fn<CelestrakClient['fetchGroup']>()
      .mockResolvedValueOnce([ommFixture(25544, 'ISS (ZARYA)')]);
    const { service, repo, celestrak } = makeService(fetchGroup);

    await service.refresh();
    const seededTimestamp = await repo.getLastRefresh();
    expect(await repo.count()).toBe(1);
    expect(seededTimestamp).not.toBeNull();

    // Then: CelesTrak goes down. Use fake timers so retry backoff is instant.
    (celestrak.fetchGroup as ReturnType<typeof vi.fn>).mockRejectedValue(
      new CelestrakError('CelesTrak returned 500 for group "stations"', 500),
    );

    vi.useFakeTimers();
    const pending = service.refresh({ force: true });
    await vi.runAllTimersAsync();
    const result = await pending;

    // The cycle reports the failure but the cache is untouched.
    expect(result.groups[0]).toMatchObject({ group: 'stations', ok: false });
    expect(result.groups[0].error).toContain('500');
    expect(await repo.count()).toBe(1);
    expect((await repo.getById(25544))?.meta.name).toBe('ISS (ZARYA)');
    // lastRefresh must NOT advance on a fully-failed cycle.
    expect(await repo.getLastRefresh()).toBe(seededTimestamp);
    // It retried before giving up (3 attempts on the failing cycle).
    expect((celestrak.fetchGroup as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(2);
  });
});
