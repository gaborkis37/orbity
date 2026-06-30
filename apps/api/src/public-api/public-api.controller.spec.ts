import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configureApplication } from '../app.setup';
import { PublicApiController } from './public-api.controller';
import { SatellitesQueryDto, SearchQueryDto } from './public-api.dto';
import { PublicApiService } from './public-api.service';

describe('public API HTTP contract', () => {
  let app: INestApplication;

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
      controllers: [PublicApiController],
      providers: [{ provide: PublicApiService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    configureApplication(app, ['http://localhost:3000']);
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
    expect(response.body.count).toBe(6_001);
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
