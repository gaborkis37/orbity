import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConfigTree } from '../config/configuration';

/** Minimal shape we read off the incoming request (avoids an express types dep). */
interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Guards admin-only routes with a shared secret (`ADMIN_TOKEN`). Accepts the
 * token via `Authorization: Bearer <token>` or an `x-admin-token` header. Fails
 * closed: if no `ADMIN_TOKEN` is configured, every request is rejected so the
 * endpoint can never be hit anonymously.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  private readonly logger = new Logger(AdminTokenGuard.name);

  constructor(private readonly config: ConfigService<ConfigTree, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.getOrThrow('app', { infer: true }).adminToken;
    if (!expected) {
      this.logger.warn('Admin route hit but ADMIN_TOKEN is not configured — denying');
      throw new UnauthorizedException('Admin access is not configured');
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const provided = this.extractToken(request);
    if (!provided || !this.safeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return true;
  }

  private extractToken(request: RequestLike): string | undefined {
    const header = request.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }
    const custom = request.headers['x-admin-token'];
    return typeof custom === 'string' ? custom : undefined;
  }

  /** Constant-time comparison to avoid leaking the token via timing. */
  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
