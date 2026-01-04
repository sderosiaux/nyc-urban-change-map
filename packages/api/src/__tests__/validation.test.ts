/**
 * Tests for API validation schemas
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-create the schemas here for testing (or extract to shared module)
const boundsSchema = z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/);

const placesQuerySchema = z.object({
  bounds: boundsSchema,
  zoom: z.coerce.number().min(0).max(22).optional().default(12),
  min_intensity: z.coerce.number().min(0).max(100).optional().default(0),
  certainty: z.string().optional(),
  time_mode: z.enum(['now', 'near', 'far']).optional().default('now'),
});

const heatmapQuerySchema = z.object({
  bounds: boundsSchema,
  resolution: z.coerce.number().min(7).max(10).optional().default(8),
});

const placeDetailParamsSchema = z.object({
  id: z.string().uuid(),
});

const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

describe('Validation schemas', () => {
  describe('boundsSchema', () => {
    it('should accept valid bounds', () => {
      expect(() => boundsSchema.parse('-74.0,40.7,-73.9,40.8')).not.toThrow();
    });

    it('should accept negative coordinates', () => {
      expect(() => boundsSchema.parse('-180,-90,180,90')).not.toThrow();
    });

    it('should accept decimal coordinates', () => {
      expect(() => boundsSchema.parse('-74.123,40.456,-73.789,40.999')).not.toThrow();
    });

    it('should reject invalid format', () => {
      expect(() => boundsSchema.parse('invalid')).toThrow();
      expect(() => boundsSchema.parse('-74.0,40.7,-73.9')).toThrow();
      expect(() => boundsSchema.parse('-74.0,40.7,-73.9,40.8,extra')).toThrow();
    });

    it('should reject non-numeric values', () => {
      expect(() => boundsSchema.parse('a,b,c,d')).toThrow();
    });
  });

  describe('placesQuerySchema', () => {
    it('should parse valid query with all parameters', () => {
      const result = placesQuerySchema.parse({
        bounds: '-74.0,40.7,-73.9,40.8',
        zoom: '15',
        min_intensity: '30',
        certainty: 'certain',
        time_mode: 'now',
      });

      expect(result.bounds).toBe('-74.0,40.7,-73.9,40.8');
      expect(result.zoom).toBe(15);
      expect(result.min_intensity).toBe(30);
      expect(result.certainty).toBe('certain');
      expect(result.time_mode).toBe('now');
    });

    it('should apply defaults for optional parameters', () => {
      const result = placesQuerySchema.parse({
        bounds: '-74.0,40.7,-73.9,40.8',
      });

      expect(result.zoom).toBe(12);
      expect(result.min_intensity).toBe(0);
      expect(result.time_mode).toBe('now');
    });

    it('should coerce string numbers', () => {
      const result = placesQuerySchema.parse({
        bounds: '-74.0,40.7,-73.9,40.8',
        zoom: '18',
        min_intensity: '50',
      });

      expect(result.zoom).toBe(18);
      expect(result.min_intensity).toBe(50);
    });

    it('should reject invalid time_mode', () => {
      expect(() =>
        placesQuerySchema.parse({
          bounds: '-74.0,40.7,-73.9,40.8',
          time_mode: 'invalid',
        })
      ).toThrow();
    });

    it('should reject zoom out of range', () => {
      expect(() =>
        placesQuerySchema.parse({
          bounds: '-74.0,40.7,-73.9,40.8',
          zoom: '25',
        })
      ).toThrow();

      expect(() =>
        placesQuerySchema.parse({
          bounds: '-74.0,40.7,-73.9,40.8',
          zoom: '-1',
        })
      ).toThrow();
    });

    it('should reject min_intensity out of range', () => {
      expect(() =>
        placesQuerySchema.parse({
          bounds: '-74.0,40.7,-73.9,40.8',
          min_intensity: '150',
        })
      ).toThrow();
    });
  });

  describe('heatmapQuerySchema', () => {
    it('should parse valid query', () => {
      const result = heatmapQuerySchema.parse({
        bounds: '-74.0,40.7,-73.9,40.8',
        resolution: '9',
      });

      expect(result.bounds).toBe('-74.0,40.7,-73.9,40.8');
      expect(result.resolution).toBe(9);
    });

    it('should apply default resolution', () => {
      const result = heatmapQuerySchema.parse({
        bounds: '-74.0,40.7,-73.9,40.8',
      });

      expect(result.resolution).toBe(8);
    });

    it('should reject resolution out of range', () => {
      expect(() =>
        heatmapQuerySchema.parse({
          bounds: '-74.0,40.7,-73.9,40.8',
          resolution: '5',
        })
      ).toThrow();

      expect(() =>
        heatmapQuerySchema.parse({
          bounds: '-74.0,40.7,-73.9,40.8',
          resolution: '12',
        })
      ).toThrow();
    });
  });

  describe('placeDetailParamsSchema', () => {
    it('should accept valid UUID', () => {
      expect(() =>
        placeDetailParamsSchema.parse({
          id: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      expect(() =>
        placeDetailParamsSchema.parse({
          id: 'not-a-uuid',
        })
      ).toThrow();

      expect(() =>
        placeDetailParamsSchema.parse({
          id: '',
        })
      ).toThrow();
    });
  });

  describe('searchQuerySchema', () => {
    it('should parse valid search query', () => {
      const result = searchQuerySchema.parse({
        q: 'Times Square',
        limit: '10',
      });

      expect(result.q).toBe('Times Square');
      expect(result.limit).toBe(10);
    });

    it('should apply default limit', () => {
      const result = searchQuerySchema.parse({
        q: 'Brooklyn',
      });

      expect(result.limit).toBe(20);
    });

    it('should reject query too short', () => {
      expect(() =>
        searchQuerySchema.parse({
          q: 'a',
        })
      ).toThrow();
    });

    it('should reject query too long', () => {
      expect(() =>
        searchQuerySchema.parse({
          q: 'a'.repeat(101),
        })
      ).toThrow();
    });

    it('should reject limit out of range', () => {
      expect(() =>
        searchQuerySchema.parse({
          q: 'test',
          limit: '100',
        })
      ).toThrow();

      expect(() =>
        searchQuerySchema.parse({
          q: 'test',
          limit: '0',
        })
      ).toThrow();
    });
  });
});

describe('Bounds parsing', () => {
  it('should correctly extract coordinates from bounds string', () => {
    const bounds = '-74.0,40.7,-73.9,40.8';
    const [swLng, swLat, neLng, neLat] = bounds.split(',').map(Number);

    expect(swLng).toBe(-74.0);
    expect(swLat).toBe(40.7);
    expect(neLng).toBe(-73.9);
    expect(neLat).toBe(40.8);
  });

  it('should handle high precision coordinates', () => {
    const bounds = '-73.956789,40.712345,-73.912345,40.756789';
    const [swLng, swLat, neLng, neLat] = bounds.split(',').map(Number);

    expect(swLng).toBeCloseTo(-73.956789);
    expect(swLat).toBeCloseTo(40.712345);
    expect(neLng).toBeCloseTo(-73.912345);
    expect(neLat).toBeCloseTo(40.756789);
  });
});
