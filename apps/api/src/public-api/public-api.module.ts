import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CACHE_STORE, CacheStore } from '../cache/cache.store';
import type { ConfigTree } from '../config/configuration';
import { IngestionModule } from '../ingestion/ingestion.module';
import { CacheThrottlerStorage } from './cache-throttler.storage';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';

@Module({
  imports: [
    IngestionModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, CACHE_STORE],
      useFactory: (config: ConfigService<ConfigTree, true>, store: CacheStore) => {
        const app = config.getOrThrow('app', { infer: true });
        const generateKey = (_context: unknown, tracker: string, throttlerName: string) =>
          `public:${throttlerName}:${tracker}`;
        return {
          storage: new CacheThrottlerStorage(store),
          throttlers: [
            {
              name: 'default',
              ttl: app.publicRateLimitWindowMs,
              limit: app.publicRateLimitMax,
              blockDuration: app.publicRateLimitWindowMs,
              generateKey,
            },
            {
              name: 'bulk',
              ttl: app.publicRateLimitWindowMs,
              limit: app.publicBulkRateLimitMax,
              blockDuration: app.publicRateLimitWindowMs,
              generateKey,
            },
          ],
        };
      },
    }),
  ],
  controllers: [PublicApiController],
  providers: [PublicApiService],
})
export class PublicApiModule {}
