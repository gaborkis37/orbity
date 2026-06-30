import type { OmmRecord } from '@orbity/shared';

export interface WorkerSatelliteInput {
  noradId: number;
  omm: OmmRecord;
}

export interface InitializePropagationMessage {
  type: 'initialize';
  satellites: WorkerSatelliteInput[];
  intervalMs: number;
}

export type PropagationWorkerRequest = InitializePropagationMessage;

export interface PropagationReadyMessage {
  type: 'ready';
  noradIds: number[];
  rejectedCount: number;
}

export interface PropagationPositionsMessage {
  type: 'positions';
  sequence: number;
  timestamp: number;
  /** Packed ECEF Cartesian coordinates in meters: [x0, y0, z0, x1, ...]. */
  positions: ArrayBuffer;
  validCount: number;
  durationMs: number;
}

export interface PropagationErrorMessage {
  type: 'error';
  message: string;
}

export type PropagationWorkerResponse =
  PropagationReadyMessage | PropagationPositionsMessage | PropagationErrorMessage;
