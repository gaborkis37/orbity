import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OmmRecord } from '@orbity/shared';
import type { ConfigTree } from '../config/configuration';

/** Abort a CelesTrak request that stalls past this many ms. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Raised when CelesTrak returns a non-OK status or an unusable body. */
export class CelestrakError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CelestrakError';
  }
}

/**
 * Thin server-side client for CelesTrak's GP (general perturbations) API.
 *
 * It is the ONLY place that talks to CelesTrak, and nothing on a request path a
 * browser can reach injects it — clients always hit our cached endpoints. We use
 * `FORMAT=json` (OMM keywords); legacy TLE text is never parsed because the
 * 5-digit catalog overflowed and OMM carries the full 9-digit NORAD id.
 *
 * @see https://celestrak.org/NORAD/documentation/gp-data-formats.php
 */
@Injectable()
export class CelestrakClient {
  private readonly logger = new Logger(CelestrakClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService<ConfigTree, true>) {
    this.baseUrl = config.getOrThrow('app', { infer: true }).celestrakBaseUrl;
  }

  /**
   * Fetch one CelesTrak group as OMM JSON. One bulk request per group — never
   * per-object. Throws {@link CelestrakError} on a bad status, timeout, or a
   * body that is not a JSON array.
   */
  async fetchGroup(group: string): Promise<OmmRecord[]> {
    const url = `${this.baseUrl}/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'orbity/1.0 (+satellite tracker)' },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new CelestrakError(`Network error fetching group "${group}": ${reason}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new CelestrakError(
        `CelesTrak returned ${response.status} for group "${group}"`,
        response.status,
      );
    }

    const body: unknown = await response.json().catch(() => null);
    if (!Array.isArray(body)) {
      // CelesTrak answers unknown groups with a plain-text "No GP data found".
      throw new CelestrakError(`CelesTrak returned no usable JSON array for group "${group}"`);
    }

    this.logger.debug(`Fetched ${body.length} records for group "${group}"`);
    return body as OmmRecord[];
  }
}
