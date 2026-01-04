/**
 * Tests for clustering utilities
 */

import { describe, it, expect } from 'vitest';
import { createClusterIndex, getClusters, type ClusterFeature } from '../utils/clustering';
import type { PlaceFeature } from '@ucm/shared';

// Helper to create mock place features
function createPlaceFeature(
  id: string,
  lng: number,
  lat: number,
  intensity: number = 50
): PlaceFeature {
  return {
    type: 'Feature',
    id,
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    properties: {
      id,
      intensity,
      certainty: 'probable',
      nature: 'densification',
      headline: 'Test headline',
    },
  };
}

describe('createClusterIndex', () => {
  it('should create a supercluster index from features', () => {
    const features: PlaceFeature[] = [
      createPlaceFeature('1', -73.9855, 40.758),
      createPlaceFeature('2', -73.9853, 40.7582),
    ];

    const index = createClusterIndex(features);
    expect(index).toBeDefined();
  });

  it('should handle empty features array', () => {
    const index = createClusterIndex([]);
    expect(index).toBeDefined();
  });
});

describe('getClusters', () => {
  it('should cluster nearby points at low zoom', () => {
    const features: PlaceFeature[] = [
      createPlaceFeature('1', -73.9855, 40.758, 60),
      createPlaceFeature('2', -73.9853, 40.7582, 40),
      createPlaceFeature('3', -73.9854, 40.7581, 50),
    ];

    const index = createClusterIndex(features);
    const bounds: [number, number, number, number] = [-74.1, 40.6, -73.8, 40.9];
    const zoom = 10;

    const clusters = getClusters(index, bounds, zoom);

    // At zoom 10, nearby points should be clustered
    expect(clusters.length).toBeLessThan(features.length);

    // Should have at least one cluster
    const clusterFeature = clusters.find(
      (f) => f.properties.cluster === true
    ) as ClusterFeature | undefined;
    expect(clusterFeature).toBeDefined();
    expect(clusterFeature!.properties.point_count).toBe(3);
  });

  it('should not cluster at high zoom', () => {
    const features: PlaceFeature[] = [
      createPlaceFeature('1', -73.9855, 40.758),
      createPlaceFeature('2', -73.9853, 40.7582),
    ];

    const index = createClusterIndex(features);
    const bounds: [number, number, number, number] = [-74.0, 40.75, -73.97, 40.77];
    const zoom = 18;

    const clusters = getClusters(index, bounds, zoom);

    // At zoom 18, no clustering should occur
    expect(clusters.length).toBe(2);
    clusters.forEach((c) => {
      expect(c.properties.cluster).toBeFalsy();
    });
  });

  it('should compute cluster intensity as average', () => {
    const features: PlaceFeature[] = [
      createPlaceFeature('1', -73.9855, 40.758, 80),
      createPlaceFeature('2', -73.9853, 40.7582, 40),
    ];

    const index = createClusterIndex(features);
    const bounds: [number, number, number, number] = [-74.1, 40.6, -73.8, 40.9];
    const zoom = 8;

    const clusters = getClusters(index, bounds, zoom);
    const cluster = clusters.find((c) => c.properties.cluster) as ClusterFeature | undefined;

    if (cluster) {
      // Average intensity should be (80 + 40) / 2 = 60
      expect(cluster.properties.avgIntensity).toBe(60);
    }
  });

  it('should return empty array for empty index', () => {
    const index = createClusterIndex([]);
    const bounds: [number, number, number, number] = [-74.1, 40.6, -73.8, 40.9];
    const zoom = 12;

    const clusters = getClusters(index, bounds, zoom);
    expect(clusters).toEqual([]);
  });

  it('should filter clusters by bounds', () => {
    const features: PlaceFeature[] = [
      createPlaceFeature('1', -73.9855, 40.758), // Times Square
      createPlaceFeature('2', -118.2437, 34.0522), // Los Angeles
    ];

    const index = createClusterIndex(features);
    // NYC bounds only
    const bounds: [number, number, number, number] = [-74.1, 40.6, -73.8, 40.9];
    const zoom = 10;

    const clusters = getClusters(index, bounds, zoom);

    // Should only include NYC point
    expect(clusters.length).toBe(1);
  });
});
