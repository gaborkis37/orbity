import styles from './loading.module.css';

/** Route-level loading state, shown while the shell's async work streams in. */
export default function Loading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <div className={styles.orbit}>
        <span className={styles.satellite} />
      </div>
      <p className={styles.label}>Loading orbit data…</p>
    </div>
  );
}
