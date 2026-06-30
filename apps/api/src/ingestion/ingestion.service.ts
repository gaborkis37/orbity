import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { normalizeOmm, type OmmRecord } from '@orbity/shared';
import type { ConfigTree } from '../config/configuration';
import { CelestrakClient } from './celestrak.client';
import { GroupRefreshResult, RefreshResult, SatelliteRecord } from './ingestion.types';
import { SatelliteCacheRepository } from './satellite-cache.repository';

/** CelesTrak forbids refreshing a group more often than every 2 hours. */
const MIN_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;
/** ±10% randomization so many instances don't stampede CelesTrak together. */
const JITTER_FRACTION = 0.1;
/** Per-group fetch attempts before giving up for this cycle. */
const RETRY_ATTEMPTS = 3;
/** Base backoff between retries (doubles each attempt). */
const RETRY_BASE_DELAY_MS = 1_000;
/** SchedulerRegistry key for the recurring refresh timer. */
const REFRESH_TIMEOUT = 'orbity:ingestion-refresh';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Owns the CelesTrak → cache pipeline: a scheduled (and on-demand) job that
 * fetches each configured group, normalizes OMM → metadata via `@orbity/shared`,
 * and writes per-group blobs plus a rebuilt id-map and search index.
 *
 * Failure policy: a group that fails to fetch leaves its previously cached data
 * untouched — we never wipe good data on a CelesTrak outage. `lastRefresh`
 * advances only when at least one group succeeds.
 */
@Injectable()
export class IngestionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private readonly groups: string[];
  private readonly intervalMs: number;
  /** De-dupes overlapping refreshes (scheduled tick racing a manual trigger). */
  private inFlight: Promise<RefreshResult> | null = null;

  constructor(
    config: ConfigService<ConfigTree, true>,
    private readonly celestrak: CelestrakClient,
    private readonly repo: SatelliteCacheRepository,
    private readonly scheduler: SchedulerRegistry,
  ) {
    const app = config.getOrThrow('app', { infer: true });
    this.groups = app.celestrakGroups;
    this.intervalMs = app.refreshIntervalHours * 60 * 60 * 1000;
  }

  /** Run an initial refresh at boot, then schedule the recurring job. */
  onApplicationBootstrap(): void {
    void this.runScheduledRefresh();
  }

  onModuleDestroy(): void {
    this.clearTimer();
  }

  /**
   * Run one ingestion cycle. Concurrent calls share the in-flight run. Pass
   * `force` to bypass the 2 h rate-limit floor (manual admin trigger only).
   */
  refresh(options: { force?: boolean } = {}): Promise<RefreshResult> {
    if (this.inFlight) {
      this.logger.debug('Refresh already in progress — joining existing run');
      return this.inFlight;
    }
    this.inFlight = this.doRefresh(options).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Current cache status for diagnostics / the admin response. */
  async getStatus(): Promise<{ groups: string[]; total: number; lastRefresh: number | null }> {
    return {
      groups: this.groups,
      total: await this.repo.count(),
      lastRefresh: await this.repo.getLastRefresh(),
    };
  }

  private async runScheduledRefresh(): Promise<void> {
    try {
      const result = await this.refresh();
      if (result.skipped) {
        this.logger.log(`Scheduled refresh skipped (${result.reason})`);
      } else {
        const ok = result.groups.filter((g) => g.ok).length;
        this.logger.log(
          `Scheduled refresh done: ${ok}/${result.groups.length} groups ok, ${result.total} objects cached`,
        );
      }
    } catch (err) {
      this.logger.error(`Scheduled refresh threw: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.scheduleNext();
    }
  }

  private async doRefresh(options: { force?: boolean }): Promise<RefreshResult> {
    const now = Date.now();
    const last = await this.repo.getLastRefresh();

    if (!options.force && last !== null && now - last < MIN_REFRESH_INTERVAL_MS) {
      const mins = Math.round((now - last) / 60_000);
      return {
        skipped: true,
        reason: `refreshed ${mins}m ago (< 2h floor)`,
        groups: [],
        total: await this.repo.count(),
        lastRefresh: last,
      };
    }

    const results: GroupRefreshResult[] = [];
    let anySuccess = false;

    for (const group of this.groups) {
      try {
        const omms = await this.fetchWithRetry(group);
        const records = this.normalizeAll(omms, group);
        await this.repo.writeGroup(group, records);
        anySuccess = true;
        results.push({ group, ok: true, count: records.length });
        this.logger.log(`Group "${group}": cached ${records.length} objects`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.logger.error(`Group "${group}" failed; keeping last good cache: ${error}`);
        results.push({ group, ok: false, count: 0, error });
      }
    }

    // Rebuild aggregates from ALL configured groups (including any that failed
    // this cycle but still hold last-good data), so partial failures don't drop
    // objects from the id-map or search index.
    const total = await this.repo.rebuildAggregates(this.groups);

    let lastRefresh = last;
    if (anySuccess) {
      lastRefresh = now;
      await this.repo.setLastRefresh(now);
    }

    return { skipped: false, groups: results, total, lastRefresh };
  }

  private async fetchWithRetry(group: string): Promise<OmmRecord[]> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.celestrak.fetchGroup(group);
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_ATTEMPTS) {
          const backoff = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
          this.logger.warn(
            `Group "${group}" attempt ${attempt}/${RETRY_ATTEMPTS} failed; retrying in ${backoff}ms`,
          );
          await delay(backoff);
        }
      }
    }
    throw lastErr;
  }

  /** Normalize raw OMM records, skipping (and counting) any that fail SGP4 init. */
  private normalizeAll(omms: OmmRecord[], group: string): SatelliteRecord[] {
    const records: SatelliteRecord[] = [];
    let skipped = 0;
    for (const omm of omms) {
      try {
        const { meta } = normalizeOmm(omm, group);
        records.push({ meta, omm });
      } catch {
        skipped += 1;
      }
    }
    if (skipped > 0) {
      this.logger.warn(`Group "${group}": skipped ${skipped} unparseable record(s)`);
    }
    return records;
  }

  private scheduleNext(): void {
    const jitter = this.intervalMs * JITTER_FRACTION;
    const raw = this.intervalMs + (Math.random() * 2 - 1) * jitter;
    const ms = Math.max(MIN_REFRESH_INTERVAL_MS, Math.round(raw));
    this.clearTimer();
    const timer = setTimeout(() => void this.runScheduledRefresh(), ms);
    this.scheduler.addTimeout(REFRESH_TIMEOUT, timer);
    this.logger.log(`Next ingestion scheduled in ${Math.round(ms / 60_000)} min`);
  }

  private clearTimer(): void {
    if (this.scheduler.doesExist('timeout', REFRESH_TIMEOUT)) {
      this.scheduler.deleteTimeout(REFRESH_TIMEOUT);
    }
  }
}
