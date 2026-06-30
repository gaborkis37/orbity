import type { ExecutionContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configureApplication } from '../app.setup';
import { PublicApiController } from './public-api.controller';
import { SatellitesQueryDto, SearchQueryDto } from './public-api.dto';
import { PublicApiService } from './public-api.service';

describe('public API HTTP contract', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    // Vitest/esbuild does not emit method design metadata; Swagger requires it
    // when exploring Nest route parameters. Production `tsc` emits this data.
    Reflect.defineMetadata('design:paramtypes', [PublicApiService], PublicApiController);
    Reflect.defineMetadata(
      'design:paramtypes',
      [SatellitesQueryDto],
      PublicApiController.prototype,
      'satellites',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Number],
      PublicApiController.prototype,
      'satellite',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [SearchQueryDto],
      PublicApiController.prototype,
      'search',
    );
    Reflect.defineMetadata('design:paramtypes', [], PublicApiController.prototype, 'groups');

    const service = {
      satellites: vi.fn(async () => ({
        updatedAt: '2026-06-30T12:00:00.000Z',
        count: 6_001,
        satellites: Array.from({ length: 6_001 }, (_, noradId) => ({
          meta: { noradId, name: `STARLINK-${noradId}`, group: 'starlink', intlDes: '2026-001A' },
          omm: { OBJECT_NAME: `STARLINK-${noradId}`, NORAD_CAT_ID: noradId },
        })),
      })),
      satellite: vi.fn(async (noradId: number) => ({
        updatedAt: null,
        meta: { noradId, name: 'ISS (ZARYA)', group: 'stations', intlDes: '1998-067A' },
        omm: { OBJECT_NAME: 'ISS (ZARYA)', NORAD_CAT_ID: noradId },
      })),
      search: vi.fn(async (query: string) => ({ query, results: [] })),
      groupsSummary: vi.fn(async () => ({ groups: [] })),
    };
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            {
              name: 'default',
              ttl: 60_000,
              limit: 5,
              blockDuration: 60_000,
              generateKey: (_context: ExecutionContext, tracker: string, name: string) =>
                `public:${name}:${tracker}`,
            },
            {
              name: 'bulk',
              ttl: 60_000,
              limit: 2,
              blockDuration: 60_000,
              generateKey: (_context: ExecutionContext, tracker: string, name: string) =>
                `public:${name}:${tracker}`,
            },
          ],
        }),
      ],
      controllers: [PublicApiController],
      providers: [{ provide: PublicApiService, useValue: service }],
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    configureApplication(app, ['http://localhost:3000'], 1);
    await app.init();
  });

  afterAll(async () => app.close());

  it('serves bulk responses compressed with cache validators', async () => {
    const response = await request(app.getHttpServer())
      .get('/satellites?group=starlink')
      .set('Accept-Encoding', 'gzip')
      .expect(200);

    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.headers.etag).toBeTruthy();
    expect(response.headers['cache-control']).toContain('s-maxage=3600');
    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-limit-bulk']).toBe('2');
    expect(response.body.count).toBe(6_001);
  });

  it('enforces both shared and stricter bulk per-IP limits', async () => {
    const bulkIp = '198.51.100.10';
    await request(app.getHttpServer())
      .get('/satellites?group=starlink')
      .set('X-Forwarded-For', bulkIp)
      .expect(200);
    await request(app.getHttpServer())
      .get('/satellites?group=starlink')
      .set('X-Forwarded-For', bulkIp)
      .expect(200);
    const bulkBlocked = await request(app.getHttpServer())
      .get('/satellites?group=starlink')
      .set('X-Forwarded-For', bulkIp)
      .expect(429);
    expect(bulkBlocked.headers['retry-after-bulk']).toBeTruthy();

    const sharedIp = '198.51.100.11';
    for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
      await request(app.getHttpServer())
        .get('/groups')
        .set('X-Forwarded-For', sharedIp)
        .expect(200);
    }
    const sharedBlocked = await request(app.getHttpServer())
      .get('/groups')
      .set('X-Forwarded-For', sharedIp)
      .expect(429);
    expect(sharedBlocked.headers['retry-after']).toBeTruthy();
  });

  it('validates typeahead limits', async () => {
    const response = await request(app.getHttpServer()).get('/search?q=iss&limit=51');
    expect(response.status, JSON.stringify(response.body)).toBe(400);
  });

  it('publishes the endpoint contract through Swagger', async () => {
    const document = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(Object.keys(document.body.paths)).toEqual(
      expect.arrayContaining(['/satellites', '/satellites/{noradId}', '/search', '/groups']),
    );
    expect(document.body.paths['/satellites'].get.responses['200'].content).toBeTruthy();
    expect(document.body.components.schemas.SatellitesResponseDto).toBeTruthy();
    await request(app.getHttpServer()).get('/docs').expect(200);
  });
});
