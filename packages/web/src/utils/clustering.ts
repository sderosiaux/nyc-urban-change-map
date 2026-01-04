/**
 * Clustering utilities using Supercluster
 */

import Supercluster from 'supercluster';
import type { PlaceFeature, Certainty, TransformationNature } from '@ucm/shared';

// Properties used during aggregation (internal to Supercluster)
interface AggregationProperties {
  sumIntensity: number;
  maxIntensity: number;
  count: number;
  // These come from the point properties
  intensity: number;
  certainty: Certainty;
  nature: TransformationNature;
  headline: string;
  id: string;
}

// Extended properties for cluster features (output format)
export interface ClusterProperties {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
  avgIntensity: number;
  maxIntensity: number;
  dominantCertainty: Certainty;
}

export interface PointProperties {
  cluster: false;
  id: string;
  intensity: number;
  certainty: Certainty;
  nature: TransformationNature;
  headline: string;
}

export interface ClusterFeature {
  type: 'Feature';
  id?: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ClusterProperties;
}

export interface PointFeatureOutput {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: PointProperties;
}

export type ClusterOrPoint = ClusterFeature | PointFeatureOutput;

type SuperclusterIndex = Supercluster<
  {
    id: string;
    intensity: number;
    certainty: Certainty;
    nature: TransformationNature;
    headline: string;
  },
  AggregationProperties
>;

/**
 * Create a Supercluster index from place features
 */
export function createClusterIndex(features: PlaceFeature[]): SuperclusterIndex {
  const index = new Supercluster<
    {
      id: string;
      intensity: number;
      certainty: Certainty;
      nature: TransformationNature;
      headline: string;
    },
    AggregationProperties
  >({
    radius: 60, // Cluster radius in pixels
    maxZoom: 16, // Max zoom to cluster at
    minZoom: 0,
    minPoints: 2, // Minimum points to form a cluster
    map: (props) => ({
      intensity: props.intensity,
      certainty: props.certainty,
      nature: props.nature,
      headline: props.headline,
      id: props.id,
      // For aggregation
      sumIntensity: props.intensity,
      maxIntensity: props.intensity,
      count: 1,
    }),
    reduce: (accumulated, props) => {
      accumulated.sumIntensity += props.intensity;
      accumulated.maxIntensity = Math.max(accumulated.maxIntensity, props.intensity);
      accumulated.count += 1;
    },
  });

  // Convert PlaceFeature to the format expected by Supercluster
  const points = features.map((f) => ({
    type: 'Feature' as const,
    geometry: f.geometry as { type: 'Point'; coordinates: [number, number] },
    properties: {
      id: f.id,
      intensity: f.properties.intensity,
      certainty: f.properties.certainty,
      nature: f.properties.nature,
      headline: f.properties.headline,
    },
  }));

  index.load(points);

  return index;
}

/**
 * Get clusters for a given bounds and zoom level
 */
export function getClusters(
  index: SuperclusterIndex,
  bounds: [number, number, number, number], // [west, south, east, north]
  zoom: number
): ClusterOrPoint[] {
  const rawClusters = index.getClusters(bounds, Math.floor(zoom));

  return rawClusters.map((feature): ClusterOrPoint => {
    const props = feature.properties as Record<string, unknown>;

    if (props['cluster']) {
      // It's a cluster
      const count = (props['count'] as number) || (props['point_count'] as number) || 1;
      const sumIntensity = (props['sumIntensity'] as number) || 0;
      const avgIntensity = count > 0 ? Math.round(sumIntensity / count) : 0;

      return {
        type: 'Feature',
        id: props['cluster_id'] as number,
        geometry: feature.geometry as { type: 'Point'; coordinates: [number, number] },
        properties: {
          cluster: true,
          cluster_id: props['cluster_id'] as number,
          point_count: props['point_count'] as number,
          point_count_abbreviated: abbreviateNumber(props['point_count'] as number),
          avgIntensity,
          maxIntensity: (props['maxIntensity'] as number) || 0,
          dominantCertainty: 'probable' as Certainty, // Default for clusters
        },
      };
    } else {
      // It's a point
      return {
        type: 'Feature',
        id: props['id'] as string,
        geometry: feature.geometry as { type: 'Point'; coordinates: [number, number] },
        properties: {
          cluster: false,
          id: props['id'] as string,
          intensity: props['intensity'] as number,
          certainty: props['certainty'] as Certainty,
          nature: props['nature'] as TransformationNature,
          headline: props['headline'] as string,
        },
      };
    }
  });
}

/**
 * Abbreviate number for cluster labels (e.g., 1234 -> "1.2K")
 */
function abbreviateNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 10000) return (num / 1000).toFixed(1) + 'K';
  if (num < 1000000) return Math.round(num / 1000) + 'K';
  return (num / 1000000).toFixed(1) + 'M';
}

/**
 * Get expansion zoom for a cluster
 */
export function getClusterExpansionZoom(
  index: SuperclusterIndex,
  clusterId: number
): number {
  return index.getClusterExpansionZoom(clusterId);
}

/**
 * Get leaves (original points) for a cluster
 */
export function getClusterLeaves(
  index: SuperclusterIndex,
  clusterId: number,
  limit: number = 10,
  offset: number = 0
): PointFeatureOutput[] {
  const leaves = index.getLeaves(clusterId, limit, offset);

  return leaves.map((leaf) => ({
    type: 'Feature' as const,
    id: leaf.properties.id,
    geometry: leaf.geometry as { type: 'Point'; coordinates: [number, number] },
    properties: {
      cluster: false as const,
      id: leaf.properties.id,
      intensity: leaf.properties.intensity,
      certainty: leaf.properties.certainty,
      nature: leaf.properties.nature,
      headline: leaf.properties.headline,
    },
  }));
}
