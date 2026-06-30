import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IngestionService } from '../ingestion/ingestion.service';
import { RefreshResult } from '../ingestion/ingestion.types';
import { AdminTokenGuard } from './admin-token.guard';

/**
 * Operator-only endpoints, guarded by {@link AdminTokenGuard}. Triggers
 * server-side ingestion on demand; CelesTrak is still only ever reached from the
 * server, never from the browser making this call.
 */
@Controller('admin')
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(private readonly ingestion: IngestionService) {}

  /** Force a fresh ingestion cycle now, bypassing the 2 h rate-limit floor. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(): Promise<RefreshResult> {
    return this.ingestion.refresh({ force: true });
  }
}
