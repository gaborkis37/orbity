import { describe, expect, it, vi } from 'vitest';
import { createOrbitMaterial, orbitalPeriodMs, orbitSampleCount } from './selected-orbit';

describe('selected orbit sampling', () => {
  it('derives the ISS period from mean motion', () => {
    expect(orbitalPeriodMs(15.65) / 60_000).toBeCloseTo(92.01, 1);
  });

  it('keeps path density bounded for LEO and slow orbits', () => {
    expect(orbitSampleCount(92 * 60_000)).toBeGreaterThanOrEqual(120);
    expect(orbitSampleCount(24 * 60 * 60_000)).toBe(360);
  });

  it('uses a shader-capable Cesium material for the primitive polyline', () => {
    for (const browserType of [
      'HTMLCanvasElement',
      'HTMLImageElement',
      'ImageBitmap',
      'OffscreenCanvas',
    ]) {
      vi.stubGlobal(browserType, class {});
    }

    try {
      const material = createOrbitMaterial();
      expect(material.shaderSource).toEqual(expect.any(String));
      expect(material.shaderSource.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
