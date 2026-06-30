import { describe, expect, it } from 'vitest';
import type { OmmRecord } from '@orbity/shared';
import { initializeCatalog, propagateCatalogPositions } from './propagation-engine';

const ISS_OMM: OmmRecord = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2024-01-01T12:00:00.000000',
  MEAN_MOTION: 15.4981535,
  ECCENTRICITY: 0.0006703,
  INCLINATION: 51.64,
  RA_OF_ASC_NODE: 208.9163,
  ARG_OF_PERICENTER: 69.9862,
  MEAN_ANOMALY: 290.1986,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 12345,
  BSTAR: 0.0001027,
  MEAN_MOTION_DOT: 0.00016717,
  MEAN_MOTION_DDOT: 0,
};

describe('propagation engine', () => {
  it('propagates 6,001 objects into a transferable ECEF buffer within one tick', () => {
    const input = Array.from({ length: 6_001 }, (_, index) => ({
      noradId: 100_000 + index,
      omm: ISS_OMM,
    }));
    const initialized = initializeCatalog(input);

    expect(initialized.rejectedCount).toBe(0);
    expect(initialized.satellites).toHaveLength(6_001);

    const startedAt = performance.now();
    const result = propagateCatalogPositions(initialized.satellites, new Date(ISS_OMM.EPOCH));
    const durationMs = performance.now() - startedAt;

    expect(result.validCount).toBe(6_001);
    expect(result.positions).toHaveLength(6_001 * 3);
    expect(durationMs).toBeLessThan(1_000);

    const radiusMeters = Math.hypot(result.positions[0], result.positions[1], result.positions[2]);
    expect(radiusMeters).toBeGreaterThan(6_700_000);
    expect(radiusMeters).toBeLessThan(6_850_000);

    const transferred = structuredClone(result.positions.buffer, {
      transfer: [result.positions.buffer],
    });
    expect(result.positions.byteLength).toBe(0);
    expect(new Float64Array(transferred)).toHaveLength(6_001 * 3);
  });
});
