/// <reference lib="webworker" />

import { initializeCatalog, propagateCatalogPositions } from './propagation-engine';
import type {
  PropagationPositionsMessage,
  PropagationWorkerRequest,
  PropagationWorkerResponse,
} from './propagation.types';

const workerScope = self as DedicatedWorkerGlobalScope;

let timer: number | undefined;
let sequence = 0;
let catalog = initializeCatalog([]).satellites;

workerScope.onmessage = (event: MessageEvent<PropagationWorkerRequest>) => {
  if (event.data.type !== 'initialize') {
    return;
  }

  if (timer !== undefined) {
    workerScope.clearInterval(timer);
  }

  try {
    const initialized = initializeCatalog(event.data.satellites);
    catalog = initialized.satellites;
    sequence = 0;

    post({
      type: 'ready',
      noradIds: catalog.map(({ noradId }) => noradId),
      rejectedCount: initialized.rejectedCount,
    });

    tick();
    const intervalMs = Math.min(60_000, Math.max(250, Math.round(event.data.intervalMs)));
    timer = workerScope.setInterval(tick, intervalMs);
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

function tick(): void {
  const timestamp = Date.now();
  const startedAt = performance.now();
  const { positions, validCount } = propagateCatalogPositions(catalog, new Date(timestamp));
  const message: PropagationPositionsMessage = {
    type: 'positions',
    sequence: sequence++,
    timestamp,
    positions: positions.buffer as ArrayBuffer,
    validCount,
    durationMs: performance.now() - startedAt,
  };

  workerScope.postMessage(message, [message.positions]);
}

function post(message: PropagationWorkerResponse): void {
  workerScope.postMessage(message);
}

export {};
