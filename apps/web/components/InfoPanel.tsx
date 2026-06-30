import type { SatelliteState } from '@orbity/shared';
import type { SatelliteRecord } from '@/lib/api';
import styles from './InfoPanel.module.css';

interface InfoPanelProps {
  satellite: SatelliteRecord | null;
  state: SatelliteState | null;
  onClose: () => void;
}

function coordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

export function InfoPanel({ satellite, state, onClose }: InfoPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Satellite details">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Selected object</span>
          <h2 className={styles.title}>{satellite?.meta.name ?? 'Details'}</h2>
        </div>
        {satellite && (
          <button
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        )}
      </header>
      <div className={styles.body} aria-live="polite">
        {!satellite ? (
          <p className={styles.empty}>Select a satellite to see live telemetry.</p>
        ) : (
          <>
            <dl className={styles.metadata}>
              <div>
                <dt>NORAD ID</dt>
                <dd>{satellite.meta.noradId}</dd>
              </div>
              <div>
                <dt>Group</dt>
                <dd>{satellite.meta.group ?? 'Active catalog'}</dd>
              </div>
            </dl>
            <div className={styles.telemetry}>
              <div>
                <span>Altitude</span>
                <strong>{state ? `${state.altKm.toFixed(1)} km` : '—'}</strong>
              </div>
              <div>
                <span>Velocity</span>
                <strong>{state ? `${state.velocityKmS.toFixed(3)} km/s` : '—'}</strong>
              </div>
              <div>
                <span>Latitude</span>
                <strong>{state ? coordinate(state.lat, 'N', 'S') : '—'}</strong>
              </div>
              <div>
                <span>Longitude</span>
                <strong>{state ? coordinate(state.lon, 'E', 'W') : '—'}</strong>
              </div>
            </div>
            <p className={styles.live}>
              <span aria-hidden="true" /> Live · updating every second
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
