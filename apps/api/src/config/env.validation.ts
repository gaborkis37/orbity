import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Schema for the process environment. Validated once at boot; the app refuses to
 * start with an invalid configuration rather than failing later at runtime.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  PORT = 4000;

  /** Comma-separated list of allowed browser origins. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS = 'http://localhost:3000';

  /** Shared request budget per client IP across all public API routes. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  PUBLIC_RATE_LIMIT_MAX = 120;

  /** Additional, stricter request budget for the bulk catalog route. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  PUBLIC_BULK_RATE_LIMIT_MAX = 20;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @IsOptional()
  PUBLIC_RATE_LIMIT_WINDOW_MS = 60_000;

  /** Number of trusted reverse-proxy hops used when deriving the client IP. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  TRUST_PROXY_HOPS = 0;

  /** Redis (Upstash) connection string. Optional until ingestion (Task 2.2) is wired. */
  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  CELESTRAK_BASE_URL = 'https://celestrak.org/NORAD/elements';

  /** Comma-separated CelesTrak groups to ingest (one bulk request each). */
  @IsString()
  @IsOptional()
  CELESTRAK_GROUPS = 'stations,starlink,active';

  /** Ingestion cadence in hours. CelesTrak forbids refreshing more often than every 2 h. */
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @IsOptional()
  REFRESH_INTERVAL_HOURS = 6;

  /** Token guarding POST /admin/refresh (added in Task 2.2). */
  @IsString()
  @IsOptional()
  ADMIN_TOKEN?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }
  return validated;
}
