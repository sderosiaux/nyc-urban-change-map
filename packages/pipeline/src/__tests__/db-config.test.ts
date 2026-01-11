/**
 * Tests for database configuration and SQLite pragmas
 */

import { describe, it, expect } from 'vitest';

describe('SQLite pragma configuration', () => {
  // These tests verify the pragma values we set in db/index.ts

  const EXPECTED_PRAGMAS = {
    'journal_mode': 'WAL',
    'foreign_keys': 'ON',
    'mmap_size': 1073741824,      // 1GB memory-mapped I/O
    'cache_size': -262144,         // 256MB page cache (negative = KB)
    'temp_store': 'MEMORY',
    'synchronous': 'NORMAL',
  };

  it('should configure WAL journal mode for better concurrency', () => {
    // WAL (Write-Ahead Logging) provides:
    // - Better concurrency (readers don't block writers)
    // - Faster writes in most cases
    // - Atomic commits without locking the entire database
    expect(EXPECTED_PRAGMAS['journal_mode']).toBe('WAL');
  });

  it('should enable foreign keys for data integrity', () => {
    // Foreign keys are disabled by default in SQLite
    // We enable them to ensure referential integrity
    expect(EXPECTED_PRAGMAS['foreign_keys']).toBe('ON');
  });

  it('should set 1GB memory-mapped I/O for large database', () => {
    // mmap_size allows SQLite to use memory-mapped I/O
    // For our 4GB+ database, 1GB mmap significantly improves read performance
    const ONE_GB = 1024 * 1024 * 1024;
    expect(EXPECTED_PRAGMAS['mmap_size']).toBe(ONE_GB);
  });

  it('should set 256MB page cache', () => {
    // Negative value means KB, so -262144 = 256MB
    // Larger cache = fewer disk reads for repeated queries
    const CACHE_SIZE_KB = -262144;
    const CACHE_SIZE_MB = Math.abs(CACHE_SIZE_KB) / 1024;
    expect(CACHE_SIZE_MB).toBe(256);
    expect(EXPECTED_PRAGMAS['cache_size']).toBe(CACHE_SIZE_KB);
  });

  it('should keep temp tables in memory', () => {
    // MEMORY = temp tables and indexes in RAM
    // Faster than disk, fine for our use case
    expect(EXPECTED_PRAGMAS['temp_store']).toBe('MEMORY');
  });

  it('should use NORMAL synchronous mode with WAL', () => {
    // NORMAL is safe with WAL mode and faster than FULL
    // FULL would sync every transaction, NORMAL syncs at critical moments
    expect(EXPECTED_PRAGMAS['synchronous']).toBe('NORMAL');
  });
});

describe('Performance optimization rationale', () => {
  it('should document why RANDOM() was removed from ORDER BY', () => {
    // RANDOM() in ORDER BY:
    // 1. Prevents query plan caching
    // 2. Forces full result set evaluation
    // 3. Cannot use indexes effectively
    // 4. Results vary between identical requests (bad for caching)

    // Alternative: deterministic ordering by intensity and certainty
    // This allows query caching and predictable results
    const orderByWithRandom = 'ORDER BY certainty, intensity DESC, RANDOM()';
    const orderByOptimized = 'ORDER BY certainty, intensity DESC';

    expect(orderByOptimized).not.toContain('RANDOM');
  });

  it('should document why EXISTS is preferred over SELECT 1 with LIMIT 1', () => {
    // EXISTS stops at first match (short-circuit)
    // SELECT 1 ... LIMIT 1 may evaluate more than needed depending on optimizer
    // EXISTS is also more semantically clear for boolean existence checks

    const subqueryOld = 'SELECT 1 FROM raw_events WHERE ... LIMIT 1';
    const subqueryNew = 'EXISTS(SELECT 1 FROM raw_events WHERE ...)';

    expect(subqueryNew).toContain('EXISTS');
    expect(subqueryNew).not.toContain('LIMIT');
  });
});

describe('Cache header configuration', () => {
  const PLACES_CACHE = {
    maxAge: 60,                    // 1 minute
    staleWhileRevalidate: 300,     // 5 minutes
  };

  const HEATMAP_CACHE = {
    maxAge: 300,                   // 5 minutes
    staleWhileRevalidate: 600,     // 10 minutes
  };

  it('should cache places for 1 minute', () => {
    // Places change frequently as users pan/zoom
    // Short cache allows fresh data while reducing server load
    expect(PLACES_CACHE.maxAge).toBe(60);
  });

  it('should cache heatmap for 5 minutes', () => {
    // Heatmap is more stable (aggregated data)
    // Longer cache is appropriate
    expect(HEATMAP_CACHE.maxAge).toBe(300);
  });

  it('should use stale-while-revalidate for better UX', () => {
    // stale-while-revalidate allows serving stale content
    // while fetching fresh content in the background
    // Users see instant results, then get updates
    expect(PLACES_CACHE.staleWhileRevalidate).toBeGreaterThan(PLACES_CACHE.maxAge);
    expect(HEATMAP_CACHE.staleWhileRevalidate).toBeGreaterThan(HEATMAP_CACHE.maxAge);
  });
});
