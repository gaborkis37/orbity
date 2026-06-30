'use client';

import type { SatelliteState } from '@orbity/shared';
import { useCallback, useState } from 'react';
import type { SatelliteRecord } from '@/lib/api';
import type { SatelliteDisplayFilter, SatelliteFilter } from '@/lib/rendering/satellite-points';
import { ApiStatus } from './ApiStatus';
import { GlobeCanvas } from './GlobeCanvas';
import { InfoPanel } from './InfoPanel';
import { SearchBar } from './SearchBar';
import styles from './AppShell.module.css';

export function AppShell() {
  const [displayFilter, setDisplayFilter] = useState<SatelliteDisplayFilter>('all');
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteRecord | null>(null);
  const [telemetry, setTelemetry] = useState<SatelliteState | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ noradId: number; sequence: number } | null>(
    null,
  );

  const selectSatellite = useCallback((satellite: SatelliteRecord | null) => {
    setSelectedSatellite(satellite);
    setTelemetry(null);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedSatellite(null);
    setTelemetry(null);
    setFocusRequest(null);
    setDisplayFilter((current) => (typeof current === 'object' ? 'all' : current));
  }, []);

  const setCatalogFilter = useCallback((filter: SatelliteFilter) => {
    setDisplayFilter(filter);
    setFocusRequest(null);
  }, []);

  return (
    <main className={styles.shell}>
      <GlobeCanvas
        displayFilter={displayFilter}
        selectedNoradId={selectedSatellite?.meta.noradId ?? null}
        focusRequest={focusRequest}
        onDisplayFilterChange={setCatalogFilter}
        onSatelliteSelect={selectSatellite}
        onTelemetry={setTelemetry}
      />

      <div className={styles.overlay}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true" />
            <span className={styles.brandName}>Orbity</span>
          </div>
          <SearchBar
            onSelectGroup={() => {
              setDisplayFilter('starlink');
              setFocusRequest(null);
              selectSatellite(null);
            }}
            onSelectSatellite={(meta) => {
              setDisplayFilter({ noradId: meta.noradId });
              setFocusRequest((current) => ({
                noradId: meta.noradId,
                sequence: (current?.sequence ?? 0) + 1,
              }));
            }}
          />
          <ApiStatus />
        </header>

        <div className={styles.side}>
          <InfoPanel satellite={selectedSatellite} state={telemetry} onClose={closeDetails} />
        </div>
      </div>
    </main>
  );
}
