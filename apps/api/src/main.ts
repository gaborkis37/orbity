import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import type { ConfigTree } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's logs through pino (structured JSON in prod, pretty in dev).
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<ConfigTree, true>>(ConfigService);
  const { port, corsOrigins } = config.getOrThrow('app', { infer: true });

  configureApplication(app, corsOrigins);
  app.enableShutdownHooks();

  await app.listen(port);
  app.get(Logger).log(`orbity-api listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
