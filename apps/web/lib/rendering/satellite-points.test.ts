import type { Scene } from 'cesium';
import { describe, expect, it, vi } from 'vitest';
import type { SatelliteRecord } from '@/lib/api';
import { SatellitePointRenderer, satelliteKind, satelliteMatchesFilter } from './satellite-points';

function record(noradId: number, name: string, group = 'active'): SatelliteRecord {
  return {
    meta: { noradId, name, group, intlDes: '' },
    omm: {} as SatelliteRecord['omm'],
  };
}

describe('satellite point classification', () => {
  it('gives the ISS its distinct point style even in the active catalog', () => {
    expect(satelliteKind(record(25544, 'ISS (ZARYA)'))).toBe('iss');
  });

  it('recognizes Starlink records by group or name', () => {
    expect(satelliteKind(record(1, 'OBJECT', 'starlink'))).toBe('starlink');
    expect(satelliteKind(record(2, 'STARLINK-1234'))).toBe('starlink');
  });

  it('filters the existing catalog to Starlink without changing the input', () => {
    const starlink = record(1, 'STARLINK-1');
    const weather = record(2, 'NOAA 20');

    expect(satelliteMatchesFilter(starlink, 'all')).toBe(true);
    expect(satelliteMatchesFilter(weather, 'all')).toBe(true);
    expect(satelliteMatchesFilter(starlink, 'starlink')).toBe(true);
    expect(satelliteMatchesFilter(weather, 'starlink')).toBe(false);
    expect(satelliteMatchesFilter(starlink, { noradId: 1 })).toBe(true);
    expect(satelliteMatchesFilter(weather, { noradId: 1 })).toBe(false);
  });

  it('updates visibility without replacing the collection or its points', () => {
    const add = vi.fn((primitive: unknown) => primitive);
    const remove = vi.fn(() => true);
    const scene = { primitives: { add, remove } } as unknown as Scene;
    const renderer = new SatellitePointRenderer(scene, [
      record(1, 'STARLINK-1'),
      record(2, 'NOAA 20'),
    ]);
    const collection = renderer.collection;
    const firstPoint = collection.get(0);
    const secondPoint = collection.get(1);

    renderer.updatePositions(new Float64Array([1, 2, 3, 4, 5, 6]));
    renderer.setFilter('starlink');

    expect(renderer.collection).toBe(collection);
    expect(collection.get(0)).toBe(firstPoint);
    expect(collection.get(1)).toBe(secondPoint);
    expect(firstPoint.show).toBe(true);
    expect(secondPoint.show).toBe(false);
    expect(add).toHaveBeenCalledTimes(1);

    renderer.setSelected(1);
    expect(firstPoint.pixelSize).toBeGreaterThan(secondPoint.pixelSize);
    expect(firstPoint.outlineWidth).toBe(3);

    renderer.setSelected(null);
    expect(firstPoint.outlineWidth).toBe(0);

    renderer.destroy();
    expect(remove).toHaveBeenCalledOnce();
  });
});
