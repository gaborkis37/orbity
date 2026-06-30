import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';

@Module({
  imports: [IngestionModule],
  controllers: [PublicApiController],
  providers: [PublicApiService],
})
export class PublicApiModule {}
