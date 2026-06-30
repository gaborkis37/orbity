'use client';

import { useEffect } from 'react';
import styles from './error.module.css';

/** Route-level error boundary for the shell segment. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry wiring lands in Task 5.2; log to the console for now.
    console.error(error);
  }, [error]);

  return (
    <div className={styles.screen} role="alert">
      <div className={styles.card}>
        <h1 className={styles.title}>Something went off-orbit</h1>
        <p className={styles.message}>
          We couldn’t load the satellite view. This is usually temporary.
        </p>
        <button className={styles.retry} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
