'use client';

import { useState } from 'react';
import styles from './SearchBar.module.css';

/**
 * Top overlay search field. Debounced typeahead + group shortcuts arrive in
 * Task 4.1; for now this establishes the control and its place in the layout.
 */
export function SearchBar() {
  const [query, setQuery] = useState('');

  return (
    <form
      className={styles.bar}
      role="search"
      onSubmit={(e) => e.preventDefault()}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
      </svg>
      <input
        className={styles.input}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search satellites — try “starlink” or “ISS”"
        aria-label="Search satellites"
        autoComplete="off"
      />
    </form>
  );
}
