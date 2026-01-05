/**
 * Hooks for map data fetching
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useViewStore } from '../stores/viewStore';
import { getMapPlaces, getHeatmap, getPlaceDetail, search } from '../api/client';

/**
 * Round bounds to a grid to reduce cache misses on small viewport changes.
 * This means we fetch a slightly larger area and let client-side filtering handle the rest.
 */
function roundBounds(bounds: { sw: [number, number]; ne: [number, number] }, precision = 0.05) {
  return {
    sw: [
      Math.floor(bounds.sw[0] / precision) * precision,
      Math.floor(bounds.sw[1] / precision) * precision,
    ] as [number, number],
    ne: [
      Math.ceil(bounds.ne[0] / precision) * precision,
      Math.ceil(bounds.ne[1] / precision) * precision,
    ] as [number, number],
  };
}

/**
 * Round zoom to integer to reduce cache misses during smooth zooming
 */
function roundZoom(zoom: number): number {
  return Math.floor(zoom);
}

/**
 * Fetch places for the current map viewport
 * Uses rounded bounds/zoom to minimize API calls during pan/zoom
 */
export function useMapPlaces() {
  const { bounds, viewport, minIntensity, timeMode, selectedYear } = useViewStore();

  // Round bounds and zoom to reduce cache key variations
  const stableBounds = useMemo(
    () => (bounds ? roundBounds(bounds) : null),
    [bounds?.sw[0], bounds?.sw[1], bounds?.ne[0], bounds?.ne[1]]
  );
  const stableZoom = roundZoom(viewport.zoom);

  // Only include year for past/future modes
  const year = timeMode !== 'now' ? selectedYear : undefined;

  return useQuery({
    queryKey: ['mapPlaces', stableBounds, stableZoom, minIntensity, timeMode, year],
    queryFn: () => getMapPlaces({
      bounds: stableBounds!,
      zoom: stableZoom,
      minIntensity,
      timeMode,
      year,
    }),
    enabled: !!stableBounds,
    staleTime: 60_000, // 1 minute - data doesn't change often
    gcTime: 5 * 60_000, // Keep in cache for 5 minutes
  });
}

/**
 * Fetch heatmap data for the current viewport
 */
export function useHeatmap() {
  const { bounds, viewport } = useViewStore();

  // Round bounds for stable caching
  const stableBounds = useMemo(
    () => (bounds ? roundBounds(bounds, 0.1) : null), // Larger grid for heatmap
    [bounds?.sw[0], bounds?.sw[1], bounds?.ne[0], bounds?.ne[1]]
  );

  // Only fetch heatmap at low zoom levels
  const shouldFetch = !!stableBounds && viewport.zoom < 14;

  return useQuery({
    queryKey: ['heatmap', stableBounds],
    queryFn: () => getHeatmap({ bounds: stableBounds! }),
    enabled: shouldFetch,
    staleTime: 2 * 60_000, // 2 minutes - heatmap is expensive
    gcTime: 10 * 60_000,
  });
}

/**
 * Fetch details for a selected place
 */
export function usePlaceDetail(expandSources = false) {
  const { selectedPlaceId } = useViewStore();

  return useQuery({
    queryKey: ['placeDetail', selectedPlaceId, expandSources],
    queryFn: () =>
      getPlaceDetail({
        id: selectedPlaceId!,
        expandSources,
      }),
    enabled: !!selectedPlaceId,
    staleTime: 60_000,
  });
}

/**
 * Search places and neighborhoods
 */
export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => search(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}
