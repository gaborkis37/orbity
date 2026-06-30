import { Controller, Get } from '@nestjs/common';
import { helloShared, type SharedStub } from '@orbity/shared';

@Controller()
export class AppController {
  // Proves @orbity/shared imports + typechecks inside the api app (Task 1.1).
  // The real /health endpoint arrives in Task 2.1.
  @Get()
  root(): SharedStub {
    return helloShared();
  }
}
