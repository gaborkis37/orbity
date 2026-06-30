/**
 * Typed client for the Orbity API.
 *
 * The browser talks only to our own backend (never CelesTrak directly). Every
 * call goes through {@link request}, which centralises base-URL resolution,
 * timeouts, JSON parsing, and error normalisation.
 */
import { API_BASE_URL } from '../env';
import type {
  GroupsResponse,
  HealthResponse,
  SatellitesResponse,
  SearchResponse,
} from './types';

/** Error thrown for any non-2xx response or transport/parse failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** Abort the request after this many ms (default 10s). */
  timeoutMs?: number;
  /** Caller-supplied signal; merged with the internal timeout signal. */
  signal?: AbortSignal;
  /** Forwarded to fetch — lets callers opt into Next.js caching/revalidation. */
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 10_000, signal, cache, next } = options;
  const url = `${API_BASE_URL}${path}`;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const composedSignal = signal
    ? anySignal([signal, timeout.signal])
    : timeout.signal;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: composedSignal,
      cache,
      next,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError(
      aborted ? `Request timed out after ${timeoutMs}ms` : `Network error: ${String(err)}`,
      0,
      url,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status} ${res.statusText})`, res.status, url);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('Malformed JSON in response', res.status, url);
  }
}

/** Combine multiple AbortSignals into one (aborts when any input aborts). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export const api = {
  health(options?: RequestOptions): Promise<HealthResponse> {
    return request<HealthResponse>('/health', options);
  },

  satellites(options?: RequestOptions): Promise<SatellitesResponse> {
    return request<SatellitesResponse>('/satellites', options);
  },

  groups(options?: RequestOptions): Promise<GroupsResponse> {
    return request<GroupsResponse>('/groups', options);
  },

  search(query: string, options?: RequestOptions): Promise<SearchResponse> {
    return request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, options);
  },
};
