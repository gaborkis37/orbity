/**
 * @orbity/shared — types & propagation helpers reused by web, api, and (later) mobile.
 *
 * Task 1.1 ships only a stub to prove cross-package imports compile in both apps.
 * Real domain types (OmmRecord, SatelliteMeta, SatelliteState) and the SGP4
 * propagation helpers land in Task 1.2 — replace the stub below then.
 */

export const SHARED_PACKAGE_VERSION = '0.0.0' as const;

/** Temporary stub. Remove in Task 1.2 once real domain types exist. */
export interface SharedStub {
  ok: boolean;
  name: string;
}

/** Temporary stub. Remove in Task 1.2. */
export function helloShared(): SharedStub {
  return { ok: true, name: 'orbity-shared' };
}
