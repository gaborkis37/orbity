/**
 * Browser-visible runtime configuration.
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time, so we read them through
 * this single accessor to keep the fallback and the variable name in one place.
 */
export const API_BASE_URL: string = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '');

export const DEFAULT_SATELLITE_GROUP =
  process.env.NEXT_PUBLIC_SATELLITE_GROUP?.trim() || 'active';

const configuredTickMs = Number(process.env.NEXT_PUBLIC_PROPAGATION_TICK_MS ?? 1000);

/** Worker propagation cadence, bounded to avoid accidental busy loops. */
export const PROPAGATION_TICK_MS = Number.isFinite(configuredTickMs)
  ? Math.min(60_000, Math.max(250, Math.round(configuredTickMs)))
  : 1000;
