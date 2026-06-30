'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import styles from './ApiStatus.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'online'; uptime: number }
  | { kind: 'offline'; reason: string };

/**
 * Live backend connectivity badge. Doubles as the reference implementation for
 * consuming the typed API client with explicit loading and error states.
 */
export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    api
      .health({ signal: controller.signal, timeoutMs: 5000 })
      .then((res) => setState({ kind: 'online', uptime: res.uptime }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const reason = err instanceof ApiError ? err.message : 'Unreachable';
        setState({ kind: 'offline', reason });
      });

    return () => controller.abort();
  }, []);

  const { label, tone, title } = describe(state);

  return (
    <div className={`${styles.badge} ${styles[tone]}`} title={title}>
      <span className={styles.dot} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}

function describe(state: State): { label: string; tone: string; title: string } {
  switch (state.kind) {
    case 'loading':
      return { label: 'Connecting…', tone: 'loading', title: 'Checking the API' };
    case 'online':
      return {
        label: 'API online',
        tone: 'online',
        title: `Uptime ${Math.round(state.uptime)}s`,
      };
    case 'offline':
      return { label: 'API offline', tone: 'offline', title: state.reason };
  }
}
