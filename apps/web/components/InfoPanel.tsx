import type { ReactNode } from 'react';
import styles from './InfoPanel.module.css';

interface InfoPanelProps {
  title?: string;
  children?: ReactNode;
}

/**
 * Overlay panel for object details. Renders on the right on desktop and as a
 * bottom sheet on mobile. Task 4.2 fills it with live altitude/velocity for the
 * selected satellite; this is the empty/placeholder state.
 */
export function InfoPanel({ title = 'Details', children }: InfoPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Satellite details">
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
      </header>
      <div className={styles.body}>
        {children ?? (
          <p className={styles.empty}>Select a satellite to see live telemetry.</p>
        )}
      </div>
    </aside>
  );
}
