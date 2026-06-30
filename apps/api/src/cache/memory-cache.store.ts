import { CacheStore, RateLimitRecord } from './cache.store';

/**
 * In-memory {@link CacheStore} used by unit tests and Redis-less local dev.
 * Not for production: state is per-process and lost on restart.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly strings = new Map<string, string>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly rateLimits = new Map<
    string,
    { totalHits: number; expiresAt: number; blockedUntil: number }
  >();

  async get(key: string): Promise<string | null> {
    return this.strings.has(key) ? (this.strings.get(key) as string) : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.strings.delete(key);
      this.hashes.delete(key);
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashes.get(key);
    if (!hash || !hash.has(field)) return null;
    return hash.get(field) as string;
  }

  async hlen(key: string): Promise<number> {
    return this.hashes.get(key)?.size ?? 0;
  }

  async replaceHash(key: string, entries: Record<string, string>): Promise<void> {
    const fields = Object.entries(entries);
    if (fields.length === 0) {
      this.hashes.delete(key);
      return;
    }
    this.hashes.set(key, new Map(fields));
  }

  async incrementRateLimit(
    key: string,
    ttlMs: number,
    limit: number,
    blockDurationMs: number,
  ): Promise<RateLimitRecord> {
    const now = Date.now();
    let entry = this.rateLimits.get(key);

    if (!entry || entry.expiresAt <= now || (entry.blockedUntil > 0 && entry.blockedUntil <= now)) {
      entry = { totalHits: 0, expiresAt: now + ttlMs, blockedUntil: 0 };
      this.rateLimits.set(key, entry);
    }

    if (entry.blockedUntil <= now) {
      entry.totalHits += 1;
      if (entry.totalHits > limit) entry.blockedUntil = now + blockDurationMs;
    }

    return {
      totalHits: entry.totalHits,
      timeToExpire: secondsRemaining(entry.expiresAt, now),
      isBlocked: entry.blockedUntil > now,
      timeToBlockExpire: secondsRemaining(entry.blockedUntil, now),
    };
  }

  async ping(): Promise<void> {
    // Always live.
  }

  async close(): Promise<void> {
    this.strings.clear();
    this.hashes.clear();
    this.rateLimits.clear();
  }
}

function secondsRemaining(deadline: number, now: number): number {
  return deadline > now ? Math.ceil((deadline - now) / 1000) : 0;
}
