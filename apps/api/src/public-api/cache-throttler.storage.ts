import { createHash } from 'node:crypto';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { CacheStore, RateLimitRecord } from '../cache/cache.store';

/** Redis-backed in production, in-memory in local development and tests. */
export class CacheThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly store: CacheStore) {}

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<RateLimitRecord> {
    const digest = createHash('sha256').update(`${throttlerName}:${key}`).digest('hex');
    // The hash tag keeps both keys in one Redis cluster slot for the Lua script.
    return this.store.incrementRateLimit(`orbity:rate:{${digest}}`, ttl, limit, blockDuration);
  }
}
