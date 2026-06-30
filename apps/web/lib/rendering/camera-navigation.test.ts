import { Cartesian3 } from 'cesium';
import { describe, expect, it } from 'vitest';
import { earthCenteredCameraPose } from './camera-navigation';

describe('Earth-centered camera navigation', () => {
  it('preserves the viewing side while pointing exactly at Earth', () => {
    const pose = earthCenteredCameraPose(new Cartesian3(4, 2, 1), 20_000_000);

    expect(Cartesian3.magnitude(pose.destination)).toBeCloseTo(20_000_000, 5);
    expect(Cartesian3.dot(pose.destination, new Cartesian3(4, 2, 1))).toBeGreaterThan(0);
    expect(Cartesian3.dot(pose.direction, pose.destination)).toBeCloseTo(-20_000_000, 5);
    expect(Cartesian3.dot(pose.direction, pose.up)).toBeCloseTo(0, 10);
  });

  it('rejects invalid viewing distances', () => {
    expect(() => earthCenteredCameraPose(Cartesian3.UNIT_X, 0)).toThrow(
      'distance must be positive',
    );
  });
});
