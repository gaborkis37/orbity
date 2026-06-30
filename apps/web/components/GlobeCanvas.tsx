import styles from './GlobeCanvas.module.css';

/**
 * Full-viewport placeholder for the 3D globe. Task 3.2 replaces the inner
 * markup with the Resium `<Viewer>`; the sizing/stacking contract stays.
 */
export function GlobeCanvas() {
  return (
    <div className={styles.canvas} aria-hidden="true">
      <div className={styles.glow} />
      <div className={styles.placeholder}>
        <span className={styles.label}>Globe canvas</span>
        <span className={styles.sub}>Cesium viewer mounts here (Task 3.2)</span>
      </div>
    </div>
  );
}
