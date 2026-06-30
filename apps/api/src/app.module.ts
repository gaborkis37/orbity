import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import configuration, { ConfigTree } from './config/configuration';
import { NodeEnv, validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';

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
  ],
  controllers: [AppController, HealthController],
})
export class AppModule {}
