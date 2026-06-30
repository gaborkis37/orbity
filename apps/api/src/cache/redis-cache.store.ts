import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { CacheStore } from './cache.store';

/**
 * Redis-backed {@link CacheStore} (works against local Redis and Upstash —
 * Upstash speaks the Redis protocol over TLS via a `rediss://` URL).
 */
export class RedisCacheStore implements CacheStore {
  constructor(private readonly redis: Redis) {}

  /** Build a client from a connection string with sane reconnect behaviour. */
  static fromUrl(url: string): RedisCacheStore {
    const redis = new Redis(url, {
      // Fail fast on a dead connection rather than queueing commands forever.
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    return new RedisCacheStore(redis);
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.redis.del(...keys);
  }

  hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  hlen(key: string): Promise<number> {
    return this.redis.hlen(key);
  }

  async replaceHash(key: string, entries: Record<string, string>): Promise<void> {
    const fields = Object.entries(entries);
    if (fields.length === 0) {
      await this.redis.del(key);
      return;
    }
    // Build into a throwaway key, then atomically swap it in. Readers see either
    // the old hash or the fully-rebuilt one, never a partial write.
    const temp = `${key}:building:${randomUUID()}`;
    try {
      const flat: string[] = [];
      for (const [field, value] of fields) {
        flat.push(field, value);
      }
      await this.redis.hset(temp, ...flat);
      await this.redis.rename(temp, key);
    } finally {
      // RENAME consumes `temp` on success; this only matters if we threw midway.
      await this.redis.del(temp).catch(() => undefined);
    }
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
