import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';

/** Apply the same HTTP middleware and documentation to production and tests. */
export function configureApplication(
  app: NestExpressApplication,
  corsOrigins: string[],
  trustProxyHops: number,
): void {
  // Rate limiting relies on req.ip. Only trust the explicitly configured
  // number of reverse-proxy hops when resolving X-Forwarded-For.
  app.set('trust proxy', trustProxyHops);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.use(compression());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Orbity API')
    .setDescription(
      'Cached orbital elements and satellite catalog search. No endpoint proxies CelesTrak.',
    )
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
}
