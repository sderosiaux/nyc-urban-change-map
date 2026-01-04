/**
 * Tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  addMonths,
  addYears,
  formatDate,
  parseDate,
  isWithinDateRange,
  isPoint,
  isPolygon,
  getCentroid,
  isWithinBounds,
  boundsToString,
  parseBounds,
  pluralize,
  formatCount,
  capitalize,
  groupBy,
  countBy,
  maxBy,
  sortBy,
  isValidUUID,
  isValidBIN,
  isValidBBL,
} from '../utils/index.js';
import type { Point, Polygon, Bounds } from '../types/index.js';

// =============================================================================
// DATE UTILITIES
// =============================================================================

describe('Date utilities', () => {
  describe('addMonths', () => {
    it('should add months to a date', () => {
      const date = new Date('2024-01-15');
      const result = addMonths(date, 3);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getFullYear()).toBe(2024);
    });

    it('should handle year rollover', () => {
      const date = new Date('2024-11-15');
      const result = addMonths(date, 3);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getFullYear()).toBe(2025);
    });

    it('should not mutate the original date', () => {
      const date = new Date('2024-01-15');
      addMonths(date, 3);
      expect(date.getMonth()).toBe(0); // Still January
    });
  });

  describe('addYears', () => {
    it('should add years to a date', () => {
      const date = new Date('2024-06-15');
      const result = addYears(date, 2);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5); // June
    });

    it('should not mutate the original date', () => {
      const date = new Date('2024-06-15');
      addYears(date, 2);
      expect(date.getFullYear()).toBe(2024);
    });
  });

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-03-15T10:30:00Z');
      expect(formatDate(date)).toBe('2024-03-15');
    });
  });

  describe('parseDate', () => {
    it('should parse a date string', () => {
      const result = parseDate('2024-03-15');
      // Use UTC methods to avoid timezone issues
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(2); // March
      expect(result.getUTCDate()).toBe(15);
    });
  });

  describe('isWithinDateRange', () => {
    it('should return true if date is within range', () => {
      const date = new Date('2024-06-15');
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      expect(isWithinDateRange(date, start, end)).toBe(true);
    });

    it('should return true if date equals start', () => {
      const date = new Date('2024-01-01');
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      expect(isWithinDateRange(date, start, end)).toBe(true);
    });

    it('should return false if date is before range', () => {
      const date = new Date('2023-06-15');
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      expect(isWithinDateRange(date, start, end)).toBe(false);
    });
  });
});

// =============================================================================
// GEOMETRY UTILITIES
// =============================================================================

describe('Geometry utilities', () => {
  const point: Point = { type: 'Point', coordinates: [-73.95, 40.75] };
  const polygon: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-73.96, 40.76],
        [-73.94, 40.76],
        [-73.94, 40.74],
        [-73.96, 40.74],
        [-73.96, 40.76],
      ],
    ],
  };

  describe('isPoint', () => {
    it('should return true for point geometry', () => {
      expect(isPoint(point)).toBe(true);
    });

    it('should return false for polygon geometry', () => {
      expect(isPoint(polygon)).toBe(false);
    });
  });

  describe('isPolygon', () => {
    it('should return true for polygon geometry', () => {
      expect(isPolygon(polygon)).toBe(true);
    });

    it('should return false for point geometry', () => {
      expect(isPolygon(point)).toBe(false);
    });
  });

  describe('getCentroid', () => {
    it('should return coordinates for point geometry', () => {
      const result = getCentroid(point);
      expect(result).toEqual([-73.95, 40.75]);
    });

    it('should calculate centroid for polygon', () => {
      const result = getCentroid(polygon);
      expect(result[0]).toBeCloseTo(-73.95, 2);
      expect(result[1]).toBeCloseTo(40.75, 2);
    });
  });

  describe('isWithinBounds', () => {
    const bounds: Bounds = {
      sw: [-74.0, 40.7],
      ne: [-73.9, 40.8],
    };

    it('should return true if point is within bounds', () => {
      expect(isWithinBounds([-73.95, 40.75], bounds)).toBe(true);
    });

    it('should return false if point is outside bounds', () => {
      expect(isWithinBounds([-74.1, 40.75], bounds)).toBe(false);
    });

    it('should return true if point is on boundary', () => {
      expect(isWithinBounds([-74.0, 40.7], bounds)).toBe(true);
    });
  });

  describe('boundsToString and parseBounds', () => {
    const bounds: Bounds = {
      sw: [-74.0, 40.7],
      ne: [-73.9, 40.8],
    };

    it('should convert bounds to string', () => {
      expect(boundsToString(bounds)).toBe('-74,40.7,-73.9,40.8');
    });

    it('should parse bounds from string', () => {
      const result = parseBounds('-74,40.7,-73.9,40.8');
      expect(result).toEqual(bounds);
    });

    it('should throw for invalid bounds string', () => {
      expect(() => parseBounds('invalid')).toThrow('Invalid bounds string');
    });

    it('should roundtrip correctly', () => {
      const str = boundsToString(bounds);
      const result = parseBounds(str);
      expect(result).toEqual(bounds);
    });
  });
});

// =============================================================================
// TEXT UTILITIES
// =============================================================================

describe('Text utilities', () => {
  describe('pluralize', () => {
    it('should return singular for count 1', () => {
      expect(pluralize(1, 'building')).toBe('building');
    });

    it('should return default plural for count > 1', () => {
      expect(pluralize(2, 'building')).toBe('buildings');
    });

    it('should use custom plural when provided', () => {
      expect(pluralize(2, 'city', 'cities')).toBe('cities');
    });

    it('should return plural for count 0', () => {
      expect(pluralize(0, 'building')).toBe('buildings');
    });
  });

  describe('formatCount', () => {
    it('should format count with singular', () => {
      expect(formatCount(1, 'building')).toBe('1 building');
    });

    it('should format count with plural', () => {
      expect(formatCount(5, 'building')).toBe('5 buildings');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });
  });
});

// =============================================================================
// DATA UTILITIES
// =============================================================================

describe('Data utilities', () => {
  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = groupBy(items, (i) => i.type);
      expect(result.get('a')).toHaveLength(2);
      expect(result.get('b')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = groupBy([], () => 'key');
      expect(result.size).toBe(0);
    });
  });

  describe('countBy', () => {
    it('should count items by key', () => {
      const items = ['a', 'b', 'a', 'a', 'b'];
      const result = countBy(items, (i) => i);
      expect(result.get('a')).toBe(3);
      expect(result.get('b')).toBe(2);
    });
  });

  describe('maxBy', () => {
    it('should find item with max value', () => {
      const items = [{ value: 1 }, { value: 5 }, { value: 3 }];
      const result = maxBy(items, (i) => i.value);
      expect(result).toEqual({ value: 5 });
    });

    it('should return undefined for empty array', () => {
      const result = maxBy([], () => 0);
      expect(result).toBeUndefined();
    });
  });

  describe('sortBy', () => {
    it('should sort by number', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      const result = sortBy(items, (i) => i.value);
      expect(result.map((i) => i.value)).toEqual([1, 2, 3]);
    });

    it('should sort by string', () => {
      const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }];
      const result = sortBy(items, (i) => i.name);
      expect(result.map((i) => i.name)).toEqual(['a', 'b', 'c']);
    });

    it('should not mutate original array', () => {
      const items = [{ value: 3 }, { value: 1 }];
      sortBy(items, (i) => i.value);
      expect(items[0]!.value).toBe(3);
    });
  });
});

// =============================================================================
// VALIDATION
// =============================================================================

describe('Validation utilities', () => {
  describe('isValidUUID', () => {
    it('should return true for valid UUID', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('should return false for invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isValidUUID('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
    });
  });

  describe('isValidBIN', () => {
    it('should return true for valid BIN', () => {
      expect(isValidBIN('1234567')).toBe(true);
      expect(isValidBIN('3000001')).toBe(true);
    });

    it('should return false for invalid BIN', () => {
      expect(isValidBIN('0123456')).toBe(false); // Invalid borough code
      expect(isValidBIN('6123456')).toBe(false); // Invalid borough code
      expect(isValidBIN('123456')).toBe(false); // Too short
      expect(isValidBIN('12345678')).toBe(false); // Too long
    });
  });

  describe('isValidBBL', () => {
    it('should return true for valid BBL', () => {
      expect(isValidBBL('1000010001')).toBe(true);
      expect(isValidBBL('3123450067')).toBe(true);
    });

    it('should return false for invalid BBL', () => {
      expect(isValidBBL('0000010001')).toBe(false); // Invalid borough code
      expect(isValidBBL('6000010001')).toBe(false); // Invalid borough code
      expect(isValidBBL('100001000')).toBe(false); // Too short
      expect(isValidBBL('10000100011')).toBe(false); // Too long
    });
  });
});
