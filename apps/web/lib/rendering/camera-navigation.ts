import { Cartesian3, type Camera } from 'cesium';

export const DEFAULT_EARTH_VIEW_DISTANCE_M = 20_000_000;

export interface EarthCenteredCameraPose {
  destination: Cartesian3;
  direction: Cartesian3;
  up: Cartesian3;
}

/** Build a stable camera pose aimed at Earth's center from the anchor's direction. */
export function earthCenteredCameraPose(
  anchor: Cartesian3,
  distanceMeters: number,
): EarthCenteredCameraPose {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    throw new Error('Earth-centered camera distance must be positive');
  }

  const radial =
    Cartesian3.magnitudeSquared(anchor) > 1
      ? Cartesian3.normalize(anchor, new Cartesian3())
      : Cartesian3.normalize(new Cartesian3(1, 1, 0.6), new Cartesian3());
  const destination = Cartesian3.multiplyByScalar(radial, distanceMeters, new Cartesian3());
  const direction = Cartesian3.normalize(
    Cartesian3.negate(destination, new Cartesian3()),
    new Cartesian3(),
  );
  const referenceUp =
    Math.abs(Cartesian3.dot(direction, Cartesian3.UNIT_Z)) > 0.98
      ? Cartesian3.UNIT_Y
      : Cartesian3.UNIT_Z;
  const right = Cartesian3.normalize(
    Cartesian3.cross(direction, referenceUp, new Cartesian3()),
    new Cartesian3(),
  );
  const up = Cartesian3.normalize(
    Cartesian3.cross(right, direction, new Cartesian3()),
    new Cartesian3(),
  );

  return { destination, direction, up };
}

export function flyToEarthCentered(
  camera: Camera,
  distanceMeters: number,
  anchor = camera.positionWC,
): void {
  const pose = earthCenteredCameraPose(anchor, distanceMeters);
  camera.flyTo({
    destination: pose.destination,
    orientation: { direction: pose.direction, up: pose.up },
    duration: 1.2,
  });
}
