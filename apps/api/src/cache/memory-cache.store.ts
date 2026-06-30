import { CacheStore } from './cache.store';

/**
 * In-memory {@link CacheStore} used by unit tests and Redis-less local dev.
 * Not for production: state is per-process and lost on restart.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly strings = new Map<string, string>();
  private readonly hashes = new Map<string, Map<string, string>>();

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

  async ping(): Promise<void> {
    // Always live.
  }

  async close(): Promise<void> {
    this.strings.clear();
    this.hashes.clear();
  }
}
