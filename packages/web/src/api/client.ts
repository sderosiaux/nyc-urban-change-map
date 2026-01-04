/**
 * API client for Urban Change Map
 */

import type { Bounds, PlacesGeoJSON, PlaceDetail, HeatmapResponse, TimeMode } from '@ucm/shared';
import { boundsToString } from '@ucm/shared';

const API_BASE = '/api/v1';

// =============================================================================
// MAP DATA
// =============================================================================

export interface MapPlacesParams {
  bounds: Bounds;
  zoom: number;
  minIntensity?: number;
  timeMode?: TimeMode;
  year?: number;
}

export async function getMapPlaces(params: MapPlacesParams): Promise<PlacesGeoJSON> {
  const searchParams = new URLSearchParams({
    bounds: boundsToString(params.bounds),
    zoom: params.zoom.toString(),
  });

  if (params.minIntensity !== undefined) {
    searchParams.set('min_intensity', params.minIntensity.toString());
  }

  if (params.timeMode) {
    searchParams.set('time_mode', params.timeMode);
  }

  if (params.year !== undefined) {
    searchParams.set('year', params.year.toString());
  }

  const response = await fetch(`${API_BASE}/map/places?${searchParams}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export interface HeatmapParams {
  bounds: Bounds;
  resolution?: number;
}

export async function getHeatmap(params: HeatmapParams): Promise<HeatmapResponse> {
  const searchParams = new URLSearchParams({
    bounds: boundsToString(params.bounds),
  });

  if (params.resolution !== undefined) {
    searchParams.set('resolution', params.resolution.toString());
  }

  const response = await fetch(`${API_BASE}/map/heatmap?${searchParams}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// PLACE DETAILS
// =============================================================================

export interface PlaceDetailParams {
  id: string;
  expandSources?: boolean;
}

export async function getPlaceDetail(params: PlaceDetailParams): Promise<PlaceDetail> {
  const searchParams = new URLSearchParams();

  if (params.expandSources) {
    searchParams.set('expand', 'sources');
  }

  const url = searchParams.toString()
    ? `${API_BASE}/places/${params.id}?${searchParams}`
    : `${API_BASE}/places/${params.id}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Place not found');
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// SEARCH
// =============================================================================

export interface SearchResult {
  id: string;
  type: 'place' | 'neighborhood';
  name: string;
  address?: string;
  neighborhood?: string;
  borough: string;
  latitude: number;
  longitude: number;
  intensity?: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

export async function search(query: string): Promise<SearchResponse> {
  const searchParams = new URLSearchParams({ q: query });

  const response = await fetch(`${API_BASE}/search?${searchParams}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// NEIGHBORHOODS
// =============================================================================

export interface NeighborhoodStats {
  ntaCode: string;
  ntaName: string;
  borough: string;
  placeCount: number;
  avgIntensity: number;
  maxIntensity: number;
  activeTransformations: number;
}

export interface NeighborhoodsResponse {
  neighborhoods: NeighborhoodStats[];
  total: number;
  borough: string;
}

export async function getNeighborhoods(borough?: string): Promise<NeighborhoodsResponse> {
  const searchParams = new URLSearchParams();

  if (borough) {
    searchParams.set('borough', borough);
  }

  const url = searchParams.toString()
    ? `${API_BASE}/neighborhoods?${searchParams}`
    : `${API_BASE}/neighborhoods`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
