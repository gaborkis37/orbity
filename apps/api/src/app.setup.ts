import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';

/** Apply the same HTTP middleware and documentation to production and tests. */
export function configureApplication(app: INestApplication, corsOrigins: string[]): void {
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
