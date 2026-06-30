/**
 * Domain types for Orbity, shared by web, api, and (later) mobile.
 *
 * Units convention (kept explicit in field names where ambiguous):
 *   - angles in user-facing types are DEGREES
 *   - distances are KILOMETERS, speeds KILOMETERS/SECOND
 *   - timestamps are milliseconds since the Unix epoch (Date.getTime())
 */

/** A 3D vector (km for positions, km/s for velocities); the owning field names its frame. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Raw CelesTrak OMM record (FORMAT=json, OMM keywords).
 * These are the fields returned by `gp.php`. We never parse legacy TLE text:
 * the 5-digit NORAD catalog overflowed in mid-2026, so OMM JSON (which carries
 * the full NORAD_CAT_ID) is the only format we ingest.
 *
 * @see https://celestrak.org/NORAD/documentation/gp-data-formats.php
 */
export interface OmmRecord {
  OBJECT_NAME: string;
  /** International designator, e.g. "1998-067A". */
  OBJECT_ID: string;
  /** Epoch as an ISO-8601 UTC timestamp, e.g. "2026-06-30T12:00:00.000000". */
  EPOCH: string;
  /** Mean motion, revolutions per day. */
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  /** Inclination, degrees. */
  INCLINATION: number;
  /** Right ascension of the ascending node, degrees. */
  RA_OF_ASC_NODE: number;
  /** Argument of pericenter, degrees. */
  ARG_OF_PERICENTER: number;
  /** Mean anomaly, degrees. */
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  /** Full NORAD catalog id — may exceed 5 digits (up to 9). */
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  /** Drag term B*, inverse earth radii. */
  BSTAR: number;
  /** First derivative of mean motion (ignored by SGP4, kept for fidelity). */
  MEAN_MOTION_DOT: number;
  /** Second derivative of mean motion (ignored by SGP4). */
  MEAN_MOTION_DDOT: number;
}

/**
 * Normalized, app-facing metadata for a single object. `noradId` is the
 * authoritative identifier and is preserved verbatim from the OMM even when it
 * is larger than the 5 digits a TLE could hold.
 */
export interface SatelliteMeta {
  /** Authoritative NORAD catalog id (may be up to 9 digits). */
  noradId: number;
  name: string;
  /** International designator (OBJECT_ID), e.g. "1998-067A". */
  intlDes: string;
  /** CelesTrak group this object was ingested under (e.g. "starlink"); set by the ingestion layer. */
  group?: string;
  /** Object type if known (PAYLOAD / ROCKET BODY / DEBRIS); not present in gp.php OMM. */
  objectType?: string;
}

/** Instantaneous computed state of a satellite at a given moment. */
export interface SatelliteState {
  /** Geodetic latitude, degrees. */
  lat: number;
  /** Geodetic longitude, degrees. */
  lon: number;
  /** Altitude above the WGS-84 ellipsoid, kilometers. */
  altKm: number;
  /** Speed magnitude, kilometers per second. */
  velocityKmS: number;
  /** Position in the ECI frame, kilometers. */
  eciPosition: Vec3;
  /** Position in the Earth-fixed (ECEF/ECF) frame, kilometers. */
  ecefPosition: Vec3;
  /** Velocity in the ECI frame, kilometers per second. */
  eciVelocity: Vec3;
  /** Time of this state, ms since Unix epoch. */
  timestamp: number;
}

/** Ground observer location for look-angle / pass-prediction math. */
export interface Observer {
  /** Geodetic latitude, degrees. */
  latDeg: number;
  /** Geodetic longitude, degrees. */
  lonDeg: number;
  /** Height above the ellipsoid, kilometers. */
  altKm: number;
}

/** Topocentric look angles from an observer to a satellite. */
export interface LookAngle {
  /** Azimuth, degrees clockwise from north (0–360). */
  azimuthDeg: number;
  /** Elevation above the horizon, degrees (negative = below horizon). */
  elevationDeg: number;
  /** Slant range to the satellite, kilometers. */
  rangeKm: number;
}
