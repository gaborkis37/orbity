import { ApiStatus } from './ApiStatus';
import { GlobeCanvas } from './GlobeCanvas';
import { InfoPanel } from './InfoPanel';
import { SearchBar } from './SearchBar';
import styles from './AppShell.module.css';

/**
 * Top-level layout: a full-viewport globe canvas with HUD overlays floating on
 * top. The overlay layer ignores pointer events so the globe stays draggable;
 * individual controls opt back in.
 */
export function AppShell() {
  return (
    <main className={styles.shell}>
      <GlobeCanvas />

      <div className={styles.overlay}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true" />
            <span className={styles.brandName}>Orbity</span>
          </div>
          <SearchBar />
          <ApiStatus />
        </header>

        <div className={styles.side}>
          <InfoPanel />
        </div>
      </div>
    </main>
  );
}
