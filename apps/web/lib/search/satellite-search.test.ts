import { describe, expect, it } from 'vitest';
import { SearchResultCache, normalizeSearchQuery, searchShortcut } from './satellite-search';

describe('satellite search interaction', () => {
  it('normalizes whitespace and casing for cache keys', () => {
    expect(normalizeSearchQuery('  International   Space Station ')).toBe(
      'international space station',
    );
  });

  it('recognizes the required group and ISS shortcuts', () => {
    expect(searchShortcut('STARLINK')).toMatchObject({ kind: 'group', group: 'starlink' });
    expect(searchShortcut('international space station')).toMatchObject({
      kind: 'satellite',
      noradId: 25544,
    });
  });

  it('caches equivalent typeahead queries', () => {
    const cache = new SearchResultCache();
    const results = [{ noradId: 25544, name: 'ISS (ZARYA)', intlDes: '1998-067A' }];
    cache.set(' ISS ', results);
    expect(cache.get('iss')).toBe(results);
  });
});
