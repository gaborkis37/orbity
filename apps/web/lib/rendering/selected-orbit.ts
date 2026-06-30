import { normalizeOmm, propagateSatrec } from '@orbity/shared';
import {
  Cartesian3,
  Color,
  JulianDate,
  Material,
  Matrix3,
  type Polyline,
  PolylineCollection,
  Transforms,
  type Scene,
} from 'cesium';
import type { SatelliteRecord } from '@/lib/api';

const MIN_SAMPLES = 120;
const MAX_SAMPLES = 360;
const ORBIT_REFRESH_MS = 60_000;

export function orbitalPeriodMs(meanMotionRevolutionsPerDay: number): number {
  if (!Number.isFinite(meanMotionRevolutionsPerDay) || meanMotionRevolutionsPerDay <= 0) {
    throw new Error('Mean motion must be a positive finite number');
  }
  return 86_400_000 / meanMotionRevolutionsPerDay;
}

export function orbitSampleCount(periodMs: number): number {
  return Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.ceil(periodMs / 30_000)));
}

export function createOrbitMaterial(): Material {
  return Material.fromType(Material.ColorType, {
    color: Color.fromCssColorString('#55dff5').withAlpha(0.72),
  });
}

/**
 * Samples one osculating revolution in TEME and applies one fixed-frame
 * transform. Holding that transform constant produces a closed orbital ring
 * instead of mixing Earth rotation into the path over the sampled period.
 */
export function buildOrbitPositions(satellite: SatelliteRecord, at: Date): Cartesian3[] {
  const periodMs = orbitalPeriodMs(satellite.omm.MEAN_MOTION);
  const sampleCount = orbitSampleCount(periodMs);
  const { satrec } = normalizeOmm(satellite.omm);
  const temeToFixed = Transforms.computeTemeToPseudoFixedMatrix(JulianDate.fromDate(at));
  const positions: Cartesian3[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const sampleAt = new Date(at.getTime() + (periodMs * index) / sampleCount);
    const { eciPosition } = propagateSatrec(satrec, sampleAt);
    const temeKm = new Cartesian3(eciPosition.x, eciPosition.y, eciPosition.z);
    const fixedKm = Matrix3.multiplyByVector(temeToFixed, temeKm, new Cartesian3());
    positions.push(Cartesian3.multiplyByScalar(fixedKm, 1_000, fixedKm));
  }

  if (positions.length > 0) positions.push(Cartesian3.clone(positions[0]));
  return positions;
}

export class SelectedOrbitRenderer {
  readonly collection = new PolylineCollection();
  private readonly polyline: Polyline;
  private lastUpdatedAt: number;
  private destroyed = false;

  constructor(scene: Scene, satellite: SatelliteRecord, at = new Date()) {
    this.satellite = satellite;
    this.lastUpdatedAt = at.getTime();
    this.polyline = this.collection.add({
      positions: buildOrbitPositions(satellite, at),
      width: 2,
      material: createOrbitMaterial(),
    });
    scene.primitives.add(this.collection);
  }

  private readonly satellite: SatelliteRecord;

  update(timestamp: number): void {
    if (timestamp - this.lastUpdatedAt < ORBIT_REFRESH_MS) return;
    this.polyline.positions = buildOrbitPositions(this.satellite, new Date(timestamp));
    this.lastUpdatedAt = timestamp;
  }

  destroy(scene: Scene): void {
    if (this.destroyed) return;
    this.destroyed = true;
    scene.primitives.remove(this.collection);
  }
}
