import {
  BlendOption,
  Cartesian3,
  Color,
  PointPrimitiveCollection,
  type PointPrimitive,
  type Scene,
} from 'cesium';
import type { SatelliteRecord } from '@/lib/api';

export type SatelliteFilter = 'all' | 'starlink';
export type SatelliteDisplayFilter = SatelliteFilter | { noradId: number };
export type SatelliteKind = 'iss' | 'starlink' | 'station' | 'catalog';

const ISS_NORAD_ID = 25544;

const POINT_STYLE: Record<SatelliteKind, { color: Color; pixelSize: number }> = {
  iss: { color: Color.fromCssColorString('#7ff4ff'), pixelSize: 10 },
  starlink: { color: Color.fromCssColorString('#f3c969'), pixelSize: 4 },
  station: { color: Color.fromCssColorString('#af8cff'), pixelSize: 7 },
  catalog: { color: Color.fromCssColorString('#76a9ff'), pixelSize: 3 },
};

export function satelliteKind(satellite: SatelliteRecord): SatelliteKind {
  const group = satellite.meta.group?.toLowerCase() ?? '';
  const name = satellite.meta.name.toUpperCase();

  if (satellite.meta.noradId === ISS_NORAD_ID || name.includes('ISS (ZARYA)')) return 'iss';
  if (group === 'starlink' || name.startsWith('STARLINK')) return 'starlink';
  if (group === 'stations') return 'station';
  return 'catalog';
}

export function satelliteMatchesFilter(
  satellite: SatelliteRecord,
  filter: SatelliteDisplayFilter,
): boolean {
  if (typeof filter === 'object') return satellite.meta.noradId === filter.noradId;
  return filter === 'all' || satelliteKind(satellite) === 'starlink';
}

/**
 * Owns one Cesium point collection for the complete worker catalog. Position
 * frames and filters mutate its existing points; neither operation replaces
 * the scene primitive or creates per-satellite entities.
 */
export class SatellitePointRenderer {
  readonly collection = new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE });

  private readonly points: PointPrimitive[];
  private readonly positionsValid: boolean[];
  private readonly scratchPosition = new Cartesian3();
  private filter: SatelliteDisplayFilter = 'all';
  private selectedNoradId: number | null = null;
  private destroyed = false;

  constructor(
    private readonly scene: Scene,
    private readonly satellites: SatelliteRecord[],
  ) {
    this.points = satellites.map((satellite, index) => {
      const style = POINT_STYLE[satelliteKind(satellite)];
      return this.collection.add({
        id: { noradId: satellite.meta.noradId, satelliteIndex: index },
        position: Cartesian3.ZERO,
        show: false,
        color: style.color,
        pixelSize: style.pixelSize,
      });
    });
    this.positionsValid = new Array(satellites.length).fill(false);
    scene.primitives.add(this.collection);
  }

  get length(): number {
    return this.points.length;
  }

  setFilter(filter: SatelliteDisplayFilter): void {
    if (
      this.filter === filter ||
      (typeof this.filter === 'object' &&
        typeof filter === 'object' &&
        this.filter.noradId === filter.noradId)
    ) {
      return;
    }
    this.filter = filter;

    for (let index = 0; index < this.points.length; index += 1) {
      this.points[index].show =
        this.positionsValid[index] && satelliteMatchesFilter(this.satellites[index], filter);
    }
  }

  setSelected(noradId: number | null): void {
    if (this.selectedNoradId === noradId) return;

    for (let index = 0; index < this.points.length; index += 1) {
      const point = this.points[index];
      const satellite = this.satellites[index];
      const style = POINT_STYLE[satelliteKind(satellite)];
      const selected = satellite.meta.noradId === noradId;
      point.color = selected ? Color.WHITE : style.color;
      point.pixelSize = selected ? Math.max(style.pixelSize + 5, 10) : style.pixelSize;
      point.outlineColor = selected ? Color.fromCssColorString('#4da3ff') : Color.TRANSPARENT;
      point.outlineWidth = selected ? 3 : 0;
    }

    this.selectedNoradId = noradId;
  }

  updatePositions(positions: Float64Array): void {
    if (positions.length !== this.points.length * 3) {
      throw new Error(
        `Position buffer has ${positions.length} components for ${this.points.length} points`,
      );
    }

    for (let index = 0; index < this.points.length; index += 1) {
      const offset = index * 3;
      const x = positions[offset];
      const y = positions[offset + 1];
      const z = positions[offset + 2];
      const valid = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

      this.positionsValid[index] = valid;
      this.points[index].show =
        valid && satelliteMatchesFilter(this.satellites[index], this.filter);
      if (valid) {
        Cartesian3.fromElements(x, y, z, this.scratchPosition);
        this.points[index].position = this.scratchPosition;
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.primitives.remove(this.collection);
  }
}
