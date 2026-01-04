/**
 * Tests for H3 hexagon utilities
 */

import { describe, it, expect } from 'vitest';
import { getH3Index, getH3Boundary, computeHeatmapCells } from '../compute/h3.js';

describe('getH3Index', () => {
  it('should return H3 index for NYC coordinates', () => {
    // Times Square coordinates
    const lat = 40.758;
    const lng = -73.9855;
    const resolution = 8;

    const index = getH3Index(lat, lng, resolution);

    expect(index).toBeTruthy();
    expect(typeof index).toBe('string');
    expect(index.length).toBeGreaterThan(0);
  });

  it('should return different indices for different locations', () => {
    const timesSquare = getH3Index(40.758, -73.9855, 8);
    const brooklyn = getH3Index(40.6782, -73.9442, 8);

    expect(timesSquare).not.toBe(brooklyn);
  });

  it('should return same index for nearby points at low resolution', () => {
    // Two points ~100m apart
    const point1 = getH3Index(40.758, -73.9855, 7);
    const point2 = getH3Index(40.7582, -73.9853, 7);

    expect(point1).toBe(point2);
  });
});

describe('getH3Boundary', () => {
  it('should return polygon boundary for H3 index', () => {
    const index = getH3Index(40.758, -73.9855, 8);
    const boundary = getH3Boundary(index);

    // H3 hexagons have 6 vertices
    expect(boundary.length).toBe(6);

    // Each vertex is [lng, lat]
    boundary.forEach((vertex) => {
      expect(vertex.length).toBe(2);
      expect(typeof vertex[0]).toBe('number');
      expect(typeof vertex[1]).toBe('number');
      // Longitude should be negative for NYC
      expect(vertex[0]).toBeLessThan(0);
      // Latitude should be around 40
      expect(vertex[1]).toBeGreaterThan(40);
      expect(vertex[1]).toBeLessThan(41);
    });
  });
});

describe('computeHeatmapCells', () => {
  it('should aggregate places into H3 cells', () => {
    const places = [
      { id: '1', latitude: 40.758, longitude: -73.9855, intensity: 60, nature: 'densification' as const },
      { id: '2', latitude: 40.7582, longitude: -73.9853, intensity: 40, nature: 'densification' as const },
      { id: '3', latitude: 40.6782, longitude: -73.9442, intensity: 80, nature: 'renovation' as const },
    ];

    const cells = computeHeatmapCells(places, 8);

    // Should have 2 cells (Times Square area and Brooklyn)
    expect(cells.length).toBe(2);

    // Find the cell with 2 places (Times Square area)
    const timesSquareCell = cells.find((c) => c.placeCount === 2);
    expect(timesSquareCell).toBeTruthy();
    expect(timesSquareCell!.avgIntensity).toBe(50); // (60 + 40) / 2
    expect(timesSquareCell!.maxIntensity).toBe(60);
    expect(timesSquareCell!.dominantNature).toBe('densification');

    // Find the Brooklyn cell
    const brooklynCell = cells.find((c) => c.placeCount === 1);
    expect(brooklynCell).toBeTruthy();
    expect(brooklynCell!.avgIntensity).toBe(80);
    expect(brooklynCell!.maxIntensity).toBe(80);
  });

  it('should compute dominant nature by weighted voting', () => {
    const places = [
      { id: '1', latitude: 40.758, longitude: -73.9855, intensity: 50, nature: 'densification' as const },
      { id: '2', latitude: 40.7582, longitude: -73.9853, intensity: 30, nature: 'renovation' as const },
      { id: '3', latitude: 40.7581, longitude: -73.9854, intensity: 40, nature: 'renovation' as const },
    ];

    const cells = computeHeatmapCells(places, 8);
    const cell = cells[0]!;

    // 2 renovations vs 1 densification, but densification has higher weight
    // densification: 5 weight vs renovation: 2 * 2 = 4
    expect(cell.dominantNature).toBe('densification');
  });

  it('should return empty array for no places', () => {
    const cells = computeHeatmapCells([], 8);
    expect(cells).toEqual([]);
  });

  it('should include H3 boundary in each cell', () => {
    const places = [
      { id: '1', latitude: 40.758, longitude: -73.9855, intensity: 60, nature: 'densification' as const },
    ];

    const cells = computeHeatmapCells(places, 8);
    expect(cells[0]!.boundary.length).toBe(6);
  });
});
