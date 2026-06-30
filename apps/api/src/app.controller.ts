import { Controller, Get } from '@nestjs/common';
import { SHARED_PACKAGE_VERSION } from '@orbity/shared';

@Controller()
export class AppController {
  // Proves @orbity/shared imports + typechecks inside the api app.
  // The real /health endpoint arrives in Task 2.1.
  @Get()
  root(): { service: string; shared: string } {
    return { service: 'orbity-api', shared: SHARED_PACKAGE_VERSION };
  }
}
