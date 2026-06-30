import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  /** Process uptime in seconds. */
  uptime: number;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', uptime: process.uptime() };
  }
}
