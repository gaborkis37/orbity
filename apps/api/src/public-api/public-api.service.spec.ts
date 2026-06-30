import type { ConfigService } from '@nestjs/config';
import type { OmmRecord } from '@orbity/shared';
import { describe, expect, it } from 'vitest';
import { MemoryCacheStore } from '../cache/memory-cache.store';
import type { ConfigTree } from '../config/configuration';
import type { SatelliteRecord } from '../ingestion/ingestion.types';
import { SatelliteCacheRepository } from '../ingestion/satellite-cache.repository';
import { PublicApiService } from './public-api.service';

function record(noradId: number, name: string, group: string): SatelliteRecord {
  const omm: OmmRecord = {
    OBJECT_NAME: name,
    OBJECT_ID: '1998-067A',
    EPOCH: '2026-06-30T12:00:00.000000',
    MEAN_MOTION: 15.5,
    ECCENTRICITY: 0.0006,
    INCLINATION: 51.64,
    RA_OF_ASC_NODE: 247.46,
    ARG_OF_PERICENTER: 130.5,
    MEAN_ANOMALY: 325,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: noradId,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 40000,
    BSTAR: 0.0001,
    MEAN_MOTION_DOT: 0.00001,
    MEAN_MOTION_DDOT: 0,
  };
  return {
    meta: { noradId, name, group, intlDes: omm.OBJECT_ID },
    omm,
  };
}

async function fixture() {
  const repository = new SatelliteCacheRepository(new MemoryCacheStore());
  await repository.writeGroup('stations', [record(25544, 'ISS (ZARYA)', 'stations')]);
  await repository.writeGroup('starlink', [
    record(60001, 'STARLINK-1001', 'starlink'),
    record(60002, 'STARLINK-1002', 'starlink'),
  ]);
  await repository.writeGroup('active', [record(70001, 'MISSION STARLINK DEMO', 'active')]);
  await repository.rebuildAggregates(['stations', 'starlink', 'active']);
  await repository.setLastRefresh(Date.parse('2026-06-30T12:00:00.000Z'));

  const config = {
    getOrThrow: () => ({ celestrakGroups: ['stations', 'starlink', 'active'] }),
  } as unknown as ConfigService<ConfigTree, true>;
  return { service: new PublicApiService(config, repository), repository };
}

describe('PublicApiService', () => {
  it('returns ISS first for its name, alias, and exact NORAD id', async () => {
    const { service } = await fixture();

    for (const query of ['iss', 'international space station', '25544']) {
      const response = await service.search(query, 20);
      expect(response.results[0]).toMatchObject({ noradId: 25544, name: 'ISS (ZARYA)' });
    }
  });

  it('ranks exact group matches ahead of incidental name matches and caps results', async () => {
    const { service } = await fixture();
    const response = await service.search('starlink', 2);

    expect(response.results).toHaveLength(2);
    expect(response.results.every((result) => result.group === 'starlink')).toBe(true);
  });

  it('serves group records, counts, and the last refresh timestamp', async () => {
    const { service } = await fixture();

    await expect(service.satellites('starlink')).resolves.toMatchObject({
      count: 2,
      updatedAt: '2026-06-30T12:00:00.000Z',
    });
    await expect(service.satellite(25544)).resolves.toMatchObject({
      meta: { noradId: 25544 },
      updatedAt: '2026-06-30T12:00:00.000Z',
    });
    await expect(service.groupsSummary()).resolves.toMatchObject({
      groups: [
        { id: 'stations', count: 1 },
        { id: 'starlink', count: 2 },
        { id: 'active', count: 1 },
      ],
    });
  });
});
