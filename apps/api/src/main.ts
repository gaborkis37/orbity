import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { ConfigTree } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's logs through pino (structured JSON in prod, pretty in dev).
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<ConfigTree, true>>(ConfigService);
  const { port, corsOrigins } = config.getOrThrow('app', { infer: true });

  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();

  await app.listen(port);
  app.get(Logger).log(`orbity-api listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
