import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { CacheModule } from './cache/cache.module';
import configuration, { ConfigTree } from './config/configuration';
import { NodeEnv, validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { IngestionModule } from './ingestion/ingestion.module';
import { PublicApiModule } from './public-api/public-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<ConfigTree, true>) => {
        const app = config.getOrThrow('app', { infer: true });
        const isProd = app.nodeEnv === NodeEnv.Production;
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            // Pretty, human-readable logs in dev; structured JSON in production.
            transport: isProd
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
            // Health checks are noisy; keep them out of the request log.
            autoLogging: {
              ignore: (req) => req.url === '/health',
            },
            redact: ['req.headers.authorization'],
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    CacheModule,
    IngestionModule,
    PublicApiModule,
  ],
  controllers: [AppController, HealthController],
})
export class AppModule {}
