/**
 * Utility functions for Urban Change Map
 */

import type { Bounds, Geometry, Point, Polygon } from '../types/index.js';

// =============================================================================
// DATE UTILITIES
// =============================================================================

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

export function isWithinDateRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

// =============================================================================
// GEOMETRY UTILITIES
// =============================================================================

export function isPoint(geometry: Geometry): geometry is Point {
  return geometry.type === 'Point';
}

export function isPolygon(geometry: Geometry): geometry is Polygon {
  return geometry.type === 'Polygon';
}

export function getCentroid(geometry: Geometry): [number, number] {
  if (isPoint(geometry)) {
    return geometry.coordinates;
  }

  // Simple centroid for polygon (average of all points)
  const coords = geometry.coordinates[0];
  if (!coords || coords.length === 0) {
    throw new Error('Invalid polygon geometry');
  }

  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng!;
    sumLat += lat!;
  }

  return [sumLng / coords.length, sumLat / coords.length];
}

export function isWithinBounds(point: [number, number], bounds: Bounds): boolean {
  const [lng, lat] = point;
  return (
    lng >= bounds.sw[0] &&
    lng <= bounds.ne[0] &&
    lat >= bounds.sw[1] &&
    lat <= bounds.ne[1]
  );
}

export function boundsToString(bounds: Bounds): string {
  return `${bounds.sw[0]},${bounds.sw[1]},${bounds.ne[0]},${bounds.ne[1]}`;
}

export function parseBounds(boundsStr: string): Bounds {
  const parts = boundsStr.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    throw new Error(`Invalid bounds string: ${boundsStr}`);
  }
  return {
    sw: [parts[0]!, parts[1]!],
    ne: [parts[2]!, parts[3]!],
  };
}

// =============================================================================
// TEXT UTILITIES
// =============================================================================

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural ?? `${singular}s`;
}

export function formatCount(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// DATA UTILITIES
// =============================================================================

export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

export function countBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function maxBy<T>(items: T[], valueFn: (item: T) => number): T | undefined {
  if (items.length === 0) return undefined;

  let maxItem = items[0]!;
  let maxValue = valueFn(maxItem);

  for (let i = 1; i < items.length; i++) {
    const item = items[i]!;
    const value = valueFn(item);
    if (value > maxValue) {
      maxItem = item;
      maxValue = value;
    }
  }

  return maxItem;
}

export function sortBy<T>(items: T[], valueFn: (item: T) => number | string): T[] {
  return [...items].sort((a, b) => {
    const va = valueFn(a);
    const vb = valueFn(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
}

// =============================================================================
// VALIDATION
// =============================================================================

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function isValidBIN(bin: string): boolean {
  // NYC BIN is 7 digits, first digit is borough code (1-5)
  return /^[1-5]\d{6}$/.test(bin);
}

export function isValidBBL(bbl: string): boolean {
  // NYC BBL is 10 digits: 1 borough + 5 block + 4 lot
  return /^[1-5]\d{9}$/.test(bbl);
}
