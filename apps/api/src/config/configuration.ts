import { NodeEnv } from './env.validation';

/** Strongly-typed application config, derived from the validated environment. */
export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  corsOrigins: string[];
  redisUrl?: string;
  celestrakBaseUrl: string;
  celestrakGroups: string[];
  refreshIntervalHours: number;
  adminToken?: string;
}

/** Top-level config tree consumed via `ConfigService.getOrThrow('app')`. */
export interface ConfigTree {
  app: AppConfig;
}

/**
 * Build the structured config from process.env. Values are already validated by
 * `validateEnv`, so parsing here is safe.
 */
export default (): ConfigTree => ({
  app: {
    nodeEnv: (process.env.NODE_ENV as NodeEnv) ?? NodeEnv.Development,
    port: parseInt(process.env.PORT ?? '4000', 10),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    redisUrl: process.env.REDIS_URL,
    celestrakBaseUrl: process.env.CELESTRAK_BASE_URL ?? 'https://celestrak.org/NORAD/elements',
    celestrakGroups: (process.env.CELESTRAK_GROUPS ?? 'stations,starlink,active')
      .split(',')
      .map((group) => group.trim())
      .filter(Boolean),
    refreshIntervalHours: parseInt(process.env.REFRESH_INTERVAL_HOURS ?? '6', 10),
    adminToken: process.env.ADMIN_TOKEN,
  },
});
