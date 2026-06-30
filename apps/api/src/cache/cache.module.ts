import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConfigTree } from '../config/configuration';
import { CACHE_STORE, CacheStore } from './cache.store';
import { MemoryCacheStore } from './memory-cache.store';
import { RedisCacheStore } from './redis-cache.store';

/**
 * Provides the application-wide {@link CacheStore}. Wires Redis when `REDIS_URL`
 * is configured, otherwise falls back to an in-memory store (fine for tests and
 * Redis-less local dev, never for production). Global so any feature module can
 * inject `CACHE_STORE` without re-importing.
 */
@Global()
@Module({
  providers: [
    {
      provide: CACHE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ConfigTree, true>): CacheStore => {
        const logger = new Logger(CacheModule.name);
        const { redisUrl } = config.getOrThrow('app', { infer: true });
        if (redisUrl) {
          logger.log('Using Redis cache store');
          return RedisCacheStore.fromUrl(redisUrl);
        }
        logger.warn('REDIS_URL not set — using in-memory cache store (non-persistent)');
        return new MemoryCacheStore();
      },
    },
  ],
  exports: [CACHE_STORE],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(@Inject(CACHE_STORE) private readonly store: CacheStore) {}

  async onApplicationShutdown(): Promise<void> {
    await this.store.close();
  }
}
