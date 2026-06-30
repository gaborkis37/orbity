'use client';

import dynamic from 'next/dynamic';
import styles from './GlobeCanvas.module.css';

const CesiumGlobe = dynamic(() => import('./CesiumGlobe').then((module) => module.CesiumGlobe), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status">
      Loading Earth…
    </div>
  ),
});

export function GlobeCanvas() {
  return (
    <div className={styles.canvas} aria-label="Interactive 3D Earth">
      <CesiumGlobe />
    </div>
  );
}
