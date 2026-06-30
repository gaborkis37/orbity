/**
 * @orbity/shared — domain types & SGP4 propagation helpers reused by web, api,
 * and (later) mobile.
 */

export const SHARED_PACKAGE_VERSION = '0.0.0' as const;

export type {
  Vec3,
  OmmRecord,
  SatelliteMeta,
  SatelliteState,
  Observer,
  LookAngle,
} from './types';

export {
  normalizeOmm,
  propagate,
  propagateSatrec,
  lookAngles,
  type NormalizedOmm,
} from './propagation';
