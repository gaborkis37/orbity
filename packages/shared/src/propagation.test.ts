import { describe, it, expect } from 'vitest';
import { normalizeOmm, propagate, propagateSatrec, lookAngles } from './propagation';
import type { OmmRecord } from './types';

/**
 * A sane, fixed ISS (ZARYA) element set. We propagate at its own epoch, where
 * the geometry is well-defined, and assert the classic ISS regime:
 * ~400–430 km altitude and ~7.6–7.7 km/s speed.
 */
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

const EPOCH = new Date(ISS_OMM.EPOCH);

describe('normalizeOmm', () => {
  it('builds a satrec with no SGP4 error and preserves metadata', () => {
    const { meta, satrec } = normalizeOmm(ISS_OMM, 'stations');
    expect(satrec.error).toBe(0);
    expect(meta.noradId).toBe(25544);
    expect(meta.name).toBe('ISS (ZARYA)');
    expect(meta.intlDes).toBe('1998-067A');
    expect(meta.group).toBe('stations');
  });

  it('preserves a 9-digit NORAD id even though a TLE satnum cannot hold it', () => {
    const bigId: OmmRecord = { ...ISS_OMM, NORAD_CAT_ID: 270_000_001 };
    const { meta, satrec } = normalizeOmm(bigId);
    // Real id survives in metadata; the throwaway TLE satnum does not equal it.
    expect(meta.noradId).toBe(270_000_001);
    expect(satrec.error).toBe(0);
    expect(satrec.satnum).not.toBe('270000001');
    // Propagation is unaffected by the catalog number.
    const state = propagateSatrec(satrec, EPOCH);
    expect(state.altKm).toBeGreaterThan(400);
    expect(state.altKm).toBeLessThan(430);
  });
});

describe('propagate (ISS at epoch)', () => {
  const state = propagate(ISS_OMM, EPOCH);

  it('computes ISS altitude in the ~400–430 km range', () => {
    expect(state.altKm).toBeGreaterThan(400);
    expect(state.altKm).toBeLessThan(430);
  });

  it('computes ISS speed in the ~7.6–7.7 km/s range', () => {
    expect(state.velocityKmS).toBeGreaterThan(7.6);
    expect(state.velocityKmS).toBeLessThan(7.7);
  });

  it('produces a latitude bounded by the inclination and a valid longitude', () => {
    expect(Math.abs(state.lat)).toBeLessThanOrEqual(ISS_OMM.INCLINATION + 0.5);
    expect(state.lon).toBeGreaterThanOrEqual(-180);
    expect(state.lon).toBeLessThanOrEqual(180);
  });

  it('returns consistent ECI vectors and timestamp', () => {
    const eciMag = Math.hypot(state.eciPosition.x, state.eciPosition.y, state.eciPosition.z);
    const ecefMag = Math.hypot(state.ecefPosition.x, state.ecefPosition.y, state.ecefPosition.z);
    // Radius from Earth's center ~ 6378 + altitude.
    expect(eciMag).toBeGreaterThan(6700);
    expect(eciMag).toBeLessThan(6850);
    // ECI → ECEF is a rotation, so it must preserve distance from Earth's center.
    expect(ecefMag).toBeCloseTo(eciMag, 8);
    expect(Math.atan2(state.ecefPosition.y, state.ecefPosition.x) * (180 / Math.PI)).toBeCloseTo(
      state.lon,
      8,
    );
    expect(state.timestamp).toBe(EPOCH.getTime());
  });

  it('moves the satellite over time', () => {
    const later = propagate(ISS_OMM, new Date(EPOCH.getTime() + 5 * 60_000));
    const moved = Math.hypot(
      later.eciPosition.x - state.eciPosition.x,
      later.eciPosition.y - state.eciPosition.y,
      later.eciPosition.z - state.eciPosition.z,
    );
    // ~7.66 km/s over 5 min should move the satellite a couple thousand km.
    expect(moved).toBeGreaterThan(1000);
  });
});

describe('lookAngles', () => {
  it('returns azimuth, elevation and range in valid ranges', () => {
    // Observer near the ISS sub-point region; exact visibility is not asserted.
    const look = lookAngles({ latDeg: 0, lonDeg: 0, altKm: 0 }, ISS_OMM, EPOCH);
    expect(look.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(look.azimuthDeg).toBeLessThanOrEqual(360);
    expect(look.elevationDeg).toBeGreaterThanOrEqual(-90);
    expect(look.elevationDeg).toBeLessThanOrEqual(90);
    expect(look.rangeKm).toBeGreaterThan(0);
  });
});
