/**
 * SGP4 propagation helpers wrapping satellite.js.
 *
 * satellite.js v5 only ingests TLE text (a 5-digit `satnum` field), but Orbity
 * works from OMM JSON whose NORAD ids can be 9 digits. The catalog number does
 * not affect the SGP4 math — only the orbital elements and B* do — so
 * `normalizeOmm` synthesizes a column-exact TLE with a throwaway satnum purely
 * to drive `twoline2satrec`, while the real id is carried in `SatelliteMeta`.
 */
import * as satellite from 'satellite.js';
import type { SatRec } from 'satellite.js';
import type { LookAngle, Observer, OmmRecord, SatelliteMeta, SatelliteState, Vec3 } from './types';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const TLE_LINE_LENGTH = 69;

/** Result of normalizing a raw OMM record: app metadata + an SGP4 satrec. */
export interface NormalizedOmm {
  meta: SatelliteMeta;
  satrec: SatRec;
}

/** Write `text` into a fixed-width line buffer starting at `at` (0-based). */
function place(buffer: string[], at: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    buffer[at + i] = text[i];
  }
}

/** Standard TLE modulo-10 checksum over the first 68 columns. */
function tleChecksum(line: string): string {
  let sum = 0;
  for (const ch of line.slice(0, 68)) {
    if (ch >= '0' && ch <= '9') sum += Number(ch);
    else if (ch === '-') sum += 1;
  }
  return String(sum % 10);
}

/** Convert an ISO epoch into TLE epoch fields: 2-digit year + day-of-year.fraction. */
function tleEpoch(epochIso: string): { yy: string; day: string } {
  const d = new Date(epochIso);
  const year = d.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const dayOfYear = (d.getTime() - startOfYear) / 86_400_000 + 1; // TLE day 1 = Jan 1
  const intPart = Math.floor(dayOfYear);
  const frac = dayOfYear - intPart;
  return {
    yy: String(year % 100).padStart(2, '0'),
    day: `${String(intPart).padStart(3, '0')}.${frac.toFixed(8).slice(2)}`,
  };
}

/** Format a non-negative angle as the 8-char "NNN.NNNN" TLE field. */
function angle8(deg: number): string {
  return deg.toFixed(4).padStart(8, ' ');
}

/** Format eccentricity as the 7-digit assumed-leading-decimal TLE field. */
function ecc7(ecc: number): string {
  return String(Math.round(ecc * 1e7)).padStart(7, '0');
}

/** Format mean motion as the 11-char "NN.NNNNNNNN" TLE field. */
function meanMotion11(revPerDay: number): string {
  return revPerDay.toFixed(8).padStart(11, '0');
}

/** Format ndot as the 10-char "±.########" TLE field (cosmetic; SGP4 ignores it). */
function ndot10(value: number): string {
  const sign = value < 0 ? '-' : ' ';
  return `${sign}.${Math.abs(value).toFixed(8).slice(2)}`;
}

/**
 * Format a value in the 8-char assumed-decimal exponential TLE field used for
 * nddot and B* (e.g. 0.0001027 -> " 10270-3", parsed as .10270e-3).
 */
function expField(value: number): string {
  if (value === 0) return ' 00000-0';
  const sign = value < 0 ? '-' : ' ';
  const a = Math.abs(value);
  let exp = Math.floor(Math.log10(a)) + 1;
  let mantissa = Math.round((a / 10 ** exp) * 1e5);
  if (mantissa >= 100_000) {
    mantissa = Math.round(mantissa / 10);
    exp += 1;
  }
  const expSign = exp < 0 ? '-' : '+';
  return `${sign}${String(mantissa).padStart(5, '0')}${expSign}${Math.abs(exp)}`;
}

/** Build the 8-char international-designator field from an OBJECT_ID like "1998-067A". */
function intlDesField(objectId: string): string {
  const match = /^(\d{4})-(\d{3})([A-Z]{0,3})$/.exec(objectId.trim());
  if (!match) return ''.padEnd(8, ' ');
  const [, year, num, piece] = match;
  return `${year.slice(2)}${num}${piece}`.padEnd(8, ' ');
}

/** Synthesize the two TLE lines for an OMM record (satnum is a throwaway placeholder). */
function ommToTleLines(omm: OmmRecord): [string, string] {
  const { yy, day } = tleEpoch(omm.EPOCH);
  const satnum = '00000'; // placeholder — real id lives in SatelliteMeta.noradId

  const l1 = new Array<string>(TLE_LINE_LENGTH).fill(' ');
  place(l1, 0, '1');
  place(l1, 2, satnum);
  place(l1, 7, (omm.CLASSIFICATION_TYPE || 'U').slice(0, 1));
  place(l1, 9, intlDesField(omm.OBJECT_ID));
  place(l1, 18, yy);
  place(l1, 20, day);
  place(l1, 33, ndot10(omm.MEAN_MOTION_DOT));
  place(l1, 44, expField(omm.MEAN_MOTION_DDOT));
  place(l1, 53, expField(omm.BSTAR));
  place(l1, 62, String(omm.EPHEMERIS_TYPE ?? 0).slice(0, 1));
  place(
    l1,
    64,
    String(omm.ELEMENT_SET_NO ?? 0)
      .padStart(4, ' ')
      .slice(0, 4),
  );
  let line1 = l1.join('');
  line1 += tleChecksum(line1);

  const l2 = new Array<string>(TLE_LINE_LENGTH).fill(' ');
  place(l2, 0, '2');
  place(l2, 2, satnum);
  place(l2, 8, angle8(omm.INCLINATION));
  place(l2, 17, angle8(omm.RA_OF_ASC_NODE));
  place(l2, 26, ecc7(omm.ECCENTRICITY));
  place(l2, 34, angle8(omm.ARG_OF_PERICENTER));
  place(l2, 43, angle8(omm.MEAN_ANOMALY));
  place(l2, 52, meanMotion11(omm.MEAN_MOTION));
  place(
    l2,
    63,
    String(omm.REV_AT_EPOCH ?? 0)
      .padStart(5, ' ')
      .slice(0, 5),
  );
  let line2 = l2.join('');
  line2 += tleChecksum(line2);

  return [line1, line2];
}

/**
 * Normalize a raw OMM record into app metadata plus a ready-to-propagate satrec.
 * Throws if satellite.js reports an initialization error.
 *
 * @param omm Raw CelesTrak OMM record.
 * @param group Optional CelesTrak group label to stamp on the metadata.
 */
export function normalizeOmm(omm: OmmRecord, group?: string): NormalizedOmm {
  const [line1, line2] = ommToTleLines(omm);
  const satrec = satellite.twoline2satrec(line1, line2);
  if (satrec.error !== 0) {
    throw new Error(`SGP4 init failed for NORAD ${omm.NORAD_CAT_ID} (error ${satrec.error})`);
  }
  const meta: SatelliteMeta = {
    noradId: omm.NORAD_CAT_ID,
    name: omm.OBJECT_NAME,
    intlDes: omm.OBJECT_ID,
    ...(group ? { group } : {}),
  };
  return { meta, satrec };
}

/**
 * Propagate an already-normalized satrec to `date`. This is the hot path used by
 * the Web Worker — normalize once, propagate many times.
 *
 * @throws if SGP4 cannot produce a position (decayed orbit / numerical error).
 */
export function propagateSatrec(satrec: SatRec, date: Date): SatelliteState {
  const pv = satellite.propagate(satrec, date);
  if (typeof pv.position !== 'object' || typeof pv.velocity !== 'object') {
    throw new Error(`Propagation failed for satnum ${satrec.satnum} at ${date.toISOString()}`);
  }
  const eciPosition: Vec3 = { x: pv.position.x, y: pv.position.y, z: pv.position.z };
  const eciVelocity: Vec3 = { x: pv.velocity.x, y: pv.velocity.y, z: pv.velocity.z };

  const gmst = satellite.gstime(date);
  const ecf = satellite.eciToEcf(pv.position, gmst);
  const ecefPosition: Vec3 = { x: ecf.x, y: ecf.y, z: ecf.z };
  const geo = satellite.eciToGeodetic(pv.position, gmst);

  return {
    lat: satellite.degreesLat(geo.latitude),
    lon: satellite.degreesLong(geo.longitude),
    altKm: geo.height,
    velocityKmS: Math.hypot(eciVelocity.x, eciVelocity.y, eciVelocity.z),
    eciPosition,
    ecefPosition,
    eciVelocity,
    timestamp: date.getTime(),
  };
}

/**
 * Convenience: normalize an OMM record and propagate it to `date` in one call.
 * For repeated propagation of the same object, prefer `normalizeOmm` once +
 * `propagateSatrec` per tick.
 */
export function propagate(omm: OmmRecord, date: Date): SatelliteState {
  return propagateSatrec(normalizeOmm(omm).satrec, date);
}

/**
 * Compute topocentric look angles (azimuth, elevation, slant range) from a
 * ground observer to a satellite at `date`. Foundation for pass prediction and
 * AR sighting.
 */
export function lookAngles(observer: Observer, omm: OmmRecord, date: Date): LookAngle {
  const { satrec } = normalizeOmm(omm);
  const pv = satellite.propagate(satrec, date);
  if (typeof pv.position !== 'object') {
    throw new Error(`Propagation failed for NORAD ${omm.NORAD_CAT_ID} at ${date.toISOString()}`);
  }
  const gmst = satellite.gstime(date);
  const ecf = satellite.eciToEcf(pv.position, gmst);
  const observerGd = {
    longitude: observer.lonDeg * DEG2RAD,
    latitude: observer.latDeg * DEG2RAD,
    height: observer.altKm,
  };
  const look = satellite.ecfToLookAngles(observerGd, ecf);
  return {
    azimuthDeg: look.azimuth * RAD2DEG,
    elevationDeg: look.elevation * RAD2DEG,
    rangeKm: look.rangeSat,
  };
}
