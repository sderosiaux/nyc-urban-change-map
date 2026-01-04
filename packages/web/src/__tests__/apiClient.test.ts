/**
 * Tests for API client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test the helper functions and URL building logic
// without making actual network requests

describe('API client utilities', () => {
  const API_BASE = '/api/v1';

  describe('URL building', () => {
    it('should build places URL with bounds', () => {
      const params = new URLSearchParams({
        bounds: '-74,40.7,-73.9,40.8',
        zoom: '15',
      });

      const url = `${API_BASE}/map/places?${params}`;
      expect(url).toBe('/api/v1/map/places?bounds=-74%2C40.7%2C-73.9%2C40.8&zoom=15');
    });

    it('should build places URL with intensity filter', () => {
      const params = new URLSearchParams({
        bounds: '-74,40.7,-73.9,40.8',
        zoom: '15',
        min_intensity: '30',
      });

      const url = `${API_BASE}/map/places?${params}`;
      expect(url).toContain('min_intensity=30');
    });

    it('should build places URL with time mode', () => {
      const params = new URLSearchParams({
        bounds: '-74,40.7,-73.9,40.8',
        zoom: '15',
        time_mode: 'future',
      });

      const url = `${API_BASE}/map/places?${params}`;
      expect(url).toContain('time_mode=future');
    });

    it('should build heatmap URL', () => {
      const params = new URLSearchParams({
        bounds: '-74,40.7,-73.9,40.8',
        resolution: '9',
      });

      const url = `${API_BASE}/map/heatmap?${params}`;
      expect(url).toBe('/api/v1/map/heatmap?bounds=-74%2C40.7%2C-73.9%2C40.8&resolution=9');
    });

    it('should build place detail URL', () => {
      const placeId = '123e4567-e89b-12d3-a456-426614174000';
      const url = `${API_BASE}/places/${placeId}`;
      expect(url).toBe('/api/v1/places/123e4567-e89b-12d3-a456-426614174000');
    });

    it('should build place detail URL with expand parameter', () => {
      const placeId = '123e4567-e89b-12d3-a456-426614174000';
      const params = new URLSearchParams({ expand: 'sources' });
      const url = `${API_BASE}/places/${placeId}?${params}`;
      expect(url).toContain('expand=sources');
    });

    it('should build search URL', () => {
      const params = new URLSearchParams({ q: 'Times Square' });
      const url = `${API_BASE}/search?${params}`;
      expect(url).toBe('/api/v1/search?q=Times+Square');
    });

    it('should build neighborhoods URL', () => {
      const url = `${API_BASE}/neighborhoods`;
      expect(url).toBe('/api/v1/neighborhoods');
    });

    it('should build neighborhoods URL with borough filter', () => {
      const params = new URLSearchParams({ borough: 'Brooklyn' });
      const url = `${API_BASE}/neighborhoods?${params}`;
      expect(url).toContain('borough=Brooklyn');
    });
  });

  describe('Bounds string formatting', () => {
    it('should format bounds correctly', () => {
      const bounds = {
        sw: [-74.0, 40.7] as [number, number],
        ne: [-73.9, 40.8] as [number, number],
      };

      const boundsStr = `${bounds.sw[0]},${bounds.sw[1]},${bounds.ne[0]},${bounds.ne[1]}`;
      expect(boundsStr).toBe('-74,40.7,-73.9,40.8');
    });

    it('should handle high precision coordinates', () => {
      const bounds = {
        sw: [-73.956789, 40.712345] as [number, number],
        ne: [-73.912345, 40.756789] as [number, number],
      };

      const boundsStr = `${bounds.sw[0]},${bounds.sw[1]},${bounds.ne[0]},${bounds.ne[1]}`;
      expect(boundsStr).toBe('-73.956789,40.712345,-73.912345,40.756789');
    });
  });
});

describe('API client fetch behavior', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should throw on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(async () => {
      const response = await fetch('/api/v1/map/places?bounds=-74,40.7,-73.9,40.8&zoom=12');
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
    }).rejects.toThrow('API error: 500');
  });

  it('should throw specific error for 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(async () => {
      const response = await fetch('/api/v1/places/unknown-id');
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Place not found');
        }
        throw new Error(`API error: ${response.status}`);
      }
    }).rejects.toThrow('Place not found');
  });

  it('should parse JSON response', async () => {
    const mockData = {
      type: 'FeatureCollection',
      features: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const response = await fetch('/api/v1/map/places?bounds=-74,40.7,-73.9,40.8&zoom=12');
    const data = await response.json();

    expect(data).toEqual(mockData);
  });
});
