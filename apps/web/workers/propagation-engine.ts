import { normalizeOmm, propagateSatrec, type NormalizedOmm } from '@orbity/shared';
import type { WorkerSatelliteInput } from './propagation.types';

const METERS_PER_KILOMETER = 1000;
const COMPONENTS_PER_POSITION = 3;

export interface TrackedSatellite {
  noradId: number;
  satrec: NormalizedOmm['satrec'];
}

export interface InitializedCatalog {
  satellites: TrackedSatellite[];
  rejectedCount: number;
}

export interface PropagatedPositions {
  positions: Float64Array;
  validCount: number;
}

/** Normalize the catalog once. Invalid/decayed records do not poison the batch. */
export function initializeCatalog(inputs: WorkerSatelliteInput[]): InitializedCatalog {
  const satellites: TrackedSatellite[] = [];
  let rejectedCount = 0;

  for (const input of inputs) {
    try {
      satellites.push({
        noradId: input.noradId,
        satrec: normalizeOmm(input.omm).satrec,
      });
    } catch {
      rejectedCount += 1;
    }
  }

  return { satellites, rejectedCount };
}

/**
 * Propagate a normalized catalog into a packed, Cesium-ready ECEF array.
 * Failed objects retain their stable slot as NaN so indexes never shift.
 */
export function propagateCatalogPositions(
  satellites: TrackedSatellite[],
  date: Date,
): PropagatedPositions {
  const positions = new Float64Array(satellites.length * COMPONENTS_PER_POSITION);
  let validCount = 0;

  for (let index = 0; index < satellites.length; index += 1) {
    const offset = index * COMPONENTS_PER_POSITION;

    try {
      const state = propagateSatrec(satellites[index].satrec, date);
      positions[offset] = state.ecefPosition.x * METERS_PER_KILOMETER;
      positions[offset + 1] = state.ecefPosition.y * METERS_PER_KILOMETER;
      positions[offset + 2] = state.ecefPosition.z * METERS_PER_KILOMETER;
      validCount += 1;
    } catch {
      positions[offset] = Number.NaN;
      positions[offset + 1] = Number.NaN;
      positions[offset + 2] = Number.NaN;
    }
  }

  return { positions, validCount };
}
