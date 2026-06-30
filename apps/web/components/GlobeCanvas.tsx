'use client';

import type { SatelliteState } from '@orbity/shared';
import dynamic from 'next/dynamic';
import type { SatelliteRecord } from '@/lib/api';
import type { SatelliteDisplayFilter, SatelliteFilter } from '@/lib/rendering/satellite-points';
import styles from './GlobeCanvas.module.css';

const CesiumGlobe = dynamic(() => import('./CesiumGlobe').then((module) => module.CesiumGlobe), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      Loading Earth…
    </div>
  ),
});

interface GlobeCanvasProps {
  displayFilter: SatelliteDisplayFilter;
  selectedNoradId: number | null;
  focusRequest: { noradId: number; sequence: number } | null;
  onDisplayFilterChange: (filter: SatelliteFilter) => void;
  onSatelliteSelect: (satellite: SatelliteRecord | null) => void;
  onTelemetry: (state: SatelliteState | null) => void;
}

export function GlobeCanvas(props: GlobeCanvasProps) {
  return (
    <div className={styles.canvas} aria-label="Interactive 3D Earth">
      <CesiumGlobe {...props} />
    </div>
  );
}
