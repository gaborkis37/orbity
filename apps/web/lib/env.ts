/**
 * Browser-visible runtime configuration.
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time, so we read them through
 * this single accessor to keep the fallback and the variable name in one place.
 */
export const API_BASE_URL: string = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '');
