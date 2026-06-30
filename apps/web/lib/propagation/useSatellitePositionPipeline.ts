'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { api, ApiError, type SatelliteRecord } from '@/lib/api';
import type { PropagationWorkerResponse, WorkerSatelliteInput } from '@/workers/propagation.types';

export interface SatellitePositionFrame {
  sequence: number;
  timestamp: number;
  positions: Float64Array;
  validCount: number;
  durationMs: number;
}

export type SatellitePipelinePhase = 'loading' | 'starting' | 'running' | 'error';

export interface SatellitePositionPipeline {
  phase: SatellitePipelinePhase;
  satellites: SatelliteRecord[];
  noradIds: number[];
  rejectedCount: number;
  error: string | null;
  latestFrameRef: MutableRefObject<SatellitePositionFrame | null>;
}

interface PipelineState {
  phase: SatellitePipelinePhase;
  satellites: SatelliteRecord[];
  noradIds: number[];
  rejectedCount: number;
  error: string | null;
}

const INITIAL_STATE: PipelineState = {
  phase: 'loading',
  satellites: [],
  noradIds: [],
  rejectedCount: 0,
  error: null,
};

/** Fetch a bulk catalog, initialize SGP4 off-thread, and retain only the latest frame. */
export function useSatellitePositionPipeline(
  group: string,
  intervalMs: number,
): SatellitePositionPipeline {
  const [state, setState] = useState<PipelineState>(INITIAL_STATE);
  const latestFrameRef = useRef<SatellitePositionFrame | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let worker: Worker | undefined;
    let recordsByNoradId = new Map<number, SatelliteRecord>();

    latestFrameRef.current = null;
    setState(INITIAL_STATE);

    api
      .satellites(group, {
        signal: controller.signal,
        timeoutMs: 30_000,
        cache: 'no-store',
      })
      .then((response) => {
        if (controller.signal.aborted) return;

        recordsByNoradId = new Map(
          response.satellites.map((record) => [record.meta.noradId, record]),
        );
        setState((current) => ({ ...current, phase: 'starting' }));

        worker = new Worker(new URL('../../workers/propagation.worker.ts', import.meta.url), {
          type: 'module',
          name: 'orbity-propagation',
        });

        worker.onmessage = (event: MessageEvent<PropagationWorkerResponse>) => {
          const message = event.data;

          switch (message.type) {
            case 'ready': {
              const satellites = message.noradIds.flatMap((noradId) => {
                const record = recordsByNoradId.get(noradId);
                return record ? [record] : [];
              });
              setState({
                phase: 'running',
                satellites,
                noradIds: message.noradIds,
                rejectedCount: message.rejectedCount,
                error: null,
              });
              break;
            }
            case 'positions':
              latestFrameRef.current = {
                sequence: message.sequence,
                timestamp: message.timestamp,
                positions: new Float64Array(message.positions),
                validCount: message.validCount,
                durationMs: message.durationMs,
              };
              break;
            case 'error':
              setState((current) => ({
                ...current,
                phase: 'error',
                error: message.message,
              }));
              break;
          }
        };

        worker.onerror = (event) => {
          setState((current) => ({
            ...current,
            phase: 'error',
            error: event.message || 'Propagation worker failed',
          }));
        };

        const satellites: WorkerSatelliteInput[] = response.satellites.map((record) => ({
          noradId: record.meta.noradId,
          omm: record.omm,
        }));
        worker.postMessage({ type: 'initialize', satellites, intervalMs });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        setState((current) => ({
          ...current,
          phase: 'error',
          error: error instanceof ApiError ? error.message : String(error),
        }));
      });

    return () => {
      controller.abort();
      worker?.terminate();
    };
  }, [group, intervalMs]);

  return { ...state, latestFrameRef };
}
