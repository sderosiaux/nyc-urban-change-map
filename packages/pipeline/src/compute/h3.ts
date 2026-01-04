/**
 * H3 hexagon utilities for heatmap aggregation
 */

import { latLngToCell, cellToBoundary } from 'h3-js';
import type { TransformationNature } from '@ucm/shared';
import { NATURE_WEIGHTS } from './nature.js';

export interface PlaceForHeatmap {
  id: string;
  latitude: number;
  longitude: number;
  intensity: number;
  nature: TransformationNature;
}

export interface HeatmapCellData {
  h3Index: string;
  centerLat: number;
  centerLng: number;
  boundary: number[][];
  avgIntensity: number;
  maxIntensity: number;
  placeCount: number;
  dominantNature: TransformationNature;
}

/**
 * Get H3 index for a lat/lng coordinate
 */
export function getH3Index(lat: number, lng: number, resolution: number): string {
  return latLngToCell(lat, lng, resolution);
}

/**
 * Get polygon boundary for an H3 index
 * Returns array of [lng, lat] coordinates
 */
export function getH3Boundary(h3Index: string): number[][] {
  // h3-js returns [lat, lng], we need [lng, lat] for GeoJSON
  const boundary = cellToBoundary(h3Index);
  return boundary.map(([lat, lng]) => [lng, lat]);
}

/**
 * Aggregate places into H3 heatmap cells
 */
export function computeHeatmapCells(
  places: PlaceForHeatmap[],
  resolution: number
): HeatmapCellData[] {
  if (places.length === 0) return [];

  // Group places by H3 cell
  const cellMap = new Map<string, PlaceForHeatmap[]>();

  for (const place of places) {
    const h3Index = getH3Index(place.latitude, place.longitude, resolution);
    const existing = cellMap.get(h3Index) ?? [];
    existing.push(place);
    cellMap.set(h3Index, existing);
  }

  // Compute aggregates for each cell
  const cells: HeatmapCellData[] = [];

  for (const [h3Index, cellPlaces] of cellMap) {
    const boundary = getH3Boundary(h3Index);

    // Compute center (average of boundary vertices)
    const centerLat = boundary.reduce((sum, v) => sum + v[1]!, 0) / boundary.length;
    const centerLng = boundary.reduce((sum, v) => sum + v[0]!, 0) / boundary.length;

    // Compute intensity stats
    const intensities = cellPlaces.map((p) => p.intensity);
    const avgIntensity = Math.round(intensities.reduce((a, b) => a + b, 0) / intensities.length);
    const maxIntensity = Math.max(...intensities);

    // Compute dominant nature by weighted voting
    const dominantNature = computeDominantNature(cellPlaces);

    cells.push({
      h3Index,
      centerLat,
      centerLng,
      boundary,
      avgIntensity,
      maxIntensity,
      placeCount: cellPlaces.length,
      dominantNature,
    });
  }

  return cells;
}

/**
 * Determine dominant nature using weighted voting
 */
function computeDominantNature(places: PlaceForHeatmap[]): TransformationNature {
  const scores: Record<TransformationNature, number> = {
    densification: 0,
    renovation: 0,
    infrastructure: 0,
    demolition: 0,
    mixed: 0,
  };

  for (const place of places) {
    const weight = NATURE_WEIGHTS[place.nature] ?? 1;
    scores[place.nature] += weight;
  }

  // Find nature with highest score
  let maxScore = 0;
  let dominant: TransformationNature = 'mixed';

  for (const [nature, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominant = nature as TransformationNature;
    }
  }

  return dominant;
}
