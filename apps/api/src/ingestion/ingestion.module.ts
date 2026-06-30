import { Module } from '@nestjs/common';
import { AdminController } from '../admin/admin.controller';
import { AdminTokenGuard } from '../admin/admin-token.guard';
import { CelestrakClient } from './celestrak.client';
import { IngestionService } from './ingestion.service';
import { SatelliteCacheRepository } from './satellite-cache.repository';

/**
 * The CelesTrak data layer (Task 2.2): ingestion job, cache repository, and the
 * guarded admin refresh endpoint. Exports the service + repository so the public
 * read endpoints (Task 2.3) can consume cached data.
 */
@Module({
  controllers: [AdminController],
  providers: [CelestrakClient, SatelliteCacheRepository, IngestionService, AdminTokenGuard],
  exports: [IngestionService, SatelliteCacheRepository],
})
export class IngestionModule {}
