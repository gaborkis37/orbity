'use client';

import type { SatelliteMeta } from '@orbity/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  SearchResultCache,
  normalizeSearchQuery,
  searchShortcut,
  type SearchShortcut,
} from '@/lib/search/satellite-search';
import styles from './SearchBar.module.css';

const SEARCH_DEBOUNCE_MS = 220;

interface SearchBarProps {
  onSelectGroup: (group: 'starlink') => void;
  onSelectSatellite: (meta: SatelliteMeta) => void;
}

type SearchOption =
  | { key: string; kind: 'shortcut'; value: SearchShortcut }
  | { key: string; kind: 'satellite'; value: SatelliteMeta };

export function SearchBar({ onSelectGroup, onSelectSatellite }: SearchBarProps) {
  const cacheRef = useRef(new SearchResultCache());
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SatelliteMeta[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const normalized = normalizeSearchQuery(query);
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(normalized);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      api
        .search(normalized, { signal: controller.signal, timeoutMs: 5_000 })
        .then((response) => {
          cacheRef.current.set(normalized, response.results);
          setResults(response.results);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const options = useMemo<SearchOption[]>(() => {
    const shortcut = searchShortcut(query);
    const shortcutNoradId = shortcut?.kind === 'satellite' ? shortcut.noradId : null;
    const shortcutOption: SearchOption[] = shortcut
      ? [{ key: `shortcut-${shortcut.kind}`, kind: 'shortcut', value: shortcut }]
      : [];
    return [
      ...shortcutOption,
      ...results
        .filter((result) => result.noradId !== shortcutNoradId)
        .map((result) => ({
          key: `satellite-${result.noradId}`,
          kind: 'satellite' as const,
          value: result,
        })),
    ];
  }, [query, results]);

  useEffect(() => setActiveIndex(0), [query, options.length]);

  function select(option: SearchOption): void {
    if (option.kind === 'shortcut') {
      const shortcut = option.value;
      if (shortcut.kind === 'group') onSelectGroup(shortcut.group);
      else {
        const result = results.find((item) => item.noradId === shortcut.noradId);
        onSelectSatellite(
          result ?? {
            noradId: shortcut.noradId,
            name: shortcut.label,
            intlDes: '1998-067A',
            group: 'stations',
          },
        );
      }
      setQuery(shortcut.kind === 'group' ? 'Starlink' : 'ISS (ZARYA)');
    } else {
      onSelectSatellite(option.value);
      setQuery(option.value.name);
    }
    setOpen(false);
    inputRef.current?.blur();
  }

  function submit(): void {
    const shortcut = searchShortcut(query);
    if (shortcut) {
      select({ key: 'submit-shortcut', kind: 'shortcut', value: shortcut });
    } else if (options[activeIndex]) {
      select(options[activeIndex]);
    }
  }

  return (
    <form
      className={styles.container}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={styles.bar}>
        <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
        </svg>
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, options.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="Search satellites — try “starlink” or “ISS”"
          aria-label="Search satellites"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="satellite-search-results"
          aria-expanded={open && (loading || options.length > 0)}
          autoComplete="off"
        />
        {loading && <span className={styles.spinner} aria-label="Searching" />}
      </div>

      {open && (loading || options.length > 0) && (
        <ul id="satellite-search-results" className={styles.results} role="listbox">
          {options.map((option, index) => {
            const label = option.kind === 'shortcut' ? option.value.label : option.value.name;
            const noradId = option.kind === 'satellite' ? option.value.noradId : null;
            return (
              <li
                key={option.key}
                className={styles.result}
                data-active={index === activeIndex}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(option)}
              >
                <span>{label}</span>
                <small>{noradId ? `NORAD ${noradId}` : 'Group filter'}</small>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
