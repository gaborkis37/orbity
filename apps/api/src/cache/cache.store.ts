/**
 * Cache abstraction for Orbity's data layer.
 *
 * The ingestion pipeline (Task 2.2) and the read endpoints (Task 2.3) talk to
 * this interface, never to a concrete client. In production it is backed by
 * Redis (Upstash); tests and Redis-less local dev use an in-memory store. The
 * connection string (`REDIS_URL`) decides which implementation is wired — see
 * `cache.module.ts`.
 */

/** DI token for the active {@link CacheStore} implementation. */
export const CACHE_STORE = Symbol('CACHE_STORE');

export interface RateLimitRecord {
  totalHits: number;
  /** Seconds until the request window expires. */
  timeToExpire: number;
  isBlocked: boolean;
  /** Seconds until the active block expires. */
  timeToBlockExpire: number;
}

export interface CacheStore {
  /** Read a string value, or `null` if the key is absent. */
  get(key: string): Promise<string | null>;

  /** Write a string value (no expiry — the catalog is long-lived). */
  set(key: string, value: string): Promise<void>;

  /** Delete one or more keys (missing keys are ignored). */
  del(...keys: string[]): Promise<void>;

  /** Read a single field from a hash, or `null` if hash/field is absent. */
  hget(key: string, field: string): Promise<string | null>;

  /** Number of fields currently in a hash (0 if absent). */
  hlen(key: string): Promise<number>;

  /**
   * Atomically replace a hash's entire contents with `entries`. Implemented as
   * build-into-temp-key-then-rename so readers never observe a half-written
   * catalog. Passing an empty object clears the hash.
   */
  replaceHash(key: string, entries: Record<string, string>): Promise<void>;

  /** Atomically consume one request from a fixed-window rate limit. */
  incrementRateLimit(
    key: string,
    ttlMs: number,
    limit: number,
    blockDurationMs: number,
  ): Promise<RateLimitRecord>;

  /** Liveness probe; rejects if the backing store is unreachable. */
  ping(): Promise<void>;

  /** Release resources (close sockets). Called on application shutdown. */
  close(): Promise<void>;
}
