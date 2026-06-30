import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore } from '../cache/memory-cache.store';
import { CacheThrottlerStorage } from './cache-throttler.storage';

describe('CacheThrottlerStorage', () => {
  afterEach(() => vi.useRealTimers());

  it('blocks requests over the limit and resets after the block expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));
    const storage = new CacheThrottlerStorage(new MemoryCacheStore());

    await expect(storage.increment('client', 60_000, 2, 60_000, 'default')).resolves.toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
    await expect(storage.increment('client', 60_000, 2, 60_000, 'default')).resolves.toMatchObject({
      totalHits: 2,
      isBlocked: false,
    });
    await expect(storage.increment('client', 60_000, 2, 60_000, 'default')).resolves.toMatchObject({
      totalHits: 3,
      isBlocked: true,
      timeToBlockExpire: 60,
    });

    vi.advanceTimersByTime(60_001);
    await expect(storage.increment('client', 60_000, 2, 60_000, 'default')).resolves.toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });
});
