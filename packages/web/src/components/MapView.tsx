/**
 * MapView - Main map component with Mapbox GL
 * Supports heatmap (low zoom), clusters (medium zoom), and points (high zoom)
 */

import { useCallback, useRef, useMemo } from 'react';
import Map, {
  Source,
  Layer,
  NavigationControl,
  type MapRef,
  type ViewStateChangeEvent,
} from 'react-map-gl';
import type { MapLayerMouseEvent, CirclePaint, FillPaint, SymbolLayout, SymbolPaint } from 'mapbox-gl';
import { useViewStore } from '../stores/viewStore';
import { useMapPlaces, useHeatmap } from '../hooks/useMapData';
import { createClusterIndex, getClusters, getClusterExpansionZoom } from '../utils/clustering';
import type { HeatmapCell } from '@ucm/shared';

// Mapbox access token - should be in env
const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

// Map style
const MAP_STYLE = 'mapbox://styles/mapbox/light-v11';

// Zoom thresholds
const HEATMAP_MAX_ZOOM = 12;
const CLUSTER_MAX_ZOOM = 16;

// Layer paint configurations
const POINT_LAYER_PAINT: CirclePaint = {
  'circle-radius': [
    'interpolate',
    ['linear'],
    ['get', 'intensity'],
    0, 4,
    50, 10,
    100, 20,
  ],
  'circle-color': [
    'interpolate',
    ['linear'],
    ['get', 'intensity'],
    0, '#94a3b8', // slate-400
    30, '#fbbf24', // amber-400
    60, '#f97316', // orange-500
    80, '#dc2626', // red-600
  ],
  'circle-opacity': [
    'match',
    ['get', 'certainty'],
    'discussion', 0.4,
    'probable', 0.7,
    'certain', 1.0,
    0.5,
  ],
  'circle-stroke-width': 1,
  'circle-stroke-color': '#fff',
};

// Cluster circle paint
const CLUSTER_LAYER_PAINT: CirclePaint = {
  'circle-radius': [
    'interpolate',
    ['linear'],
    ['get', 'point_count'],
    2, 15,
    10, 25,
    100, 40,
  ],
  'circle-color': [
    'interpolate',
    ['linear'],
    ['get', 'avgIntensity'],
    0, '#94a3b8',
    30, '#fbbf24',
    60, '#f97316',
    80, '#dc2626',
  ],
  'circle-opacity': 0.8,
  'circle-stroke-width': 2,
  'circle-stroke-color': '#fff',
};

// Cluster count label
const CLUSTER_COUNT_LAYOUT: SymbolLayout = {
  'text-field': '{point_count_abbreviated}',
  'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
  'text-size': 12,
  'text-anchor': 'center',
  'text-allow-overlap': true,
  'icon-allow-overlap': true,
};

const CLUSTER_COUNT_PAINT: SymbolPaint = {
  'text-color': '#ffffff',
};

// Heatmap fill paint
const HEATMAP_FILL_PAINT: FillPaint = {
  'fill-color': [
    'interpolate',
    ['linear'],
    ['get', 'avgIntensity'],
    0, 'rgba(148, 163, 184, 0.3)', // slate-400 transparent
    30, 'rgba(251, 191, 36, 0.4)', // amber-400
    60, 'rgba(249, 115, 22, 0.5)', // orange-500
    80, 'rgba(220, 38, 38, 0.6)', // red-600
  ],
  'fill-outline-color': [
    'interpolate',
    ['linear'],
    ['get', 'avgIntensity'],
    0, 'rgba(148, 163, 184, 0.5)',
    30, 'rgba(251, 191, 36, 0.6)',
    60, 'rgba(249, 115, 22, 0.7)',
    80, 'rgba(220, 38, 38, 0.8)',
  ],
};

/**
 * Convert H3 cells to GeoJSON FeatureCollection
 */
function heatmapToGeoJSON(cells: HeatmapCell[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature' as const,
      id: cell.h3Index,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[...cell.boundary, cell.boundary[0]!]], // Close the polygon
      },
      properties: {
        h3Index: cell.h3Index,
        avgIntensity: cell.avgIntensity,
        maxIntensity: cell.maxIntensity,
        placeCount: cell.placeCount,
        dominantNature: cell.dominantNature,
      },
    })),
  };
}

export default function MapView() {
  const mapRef = useRef<MapRef>(null);

  const { viewport, bounds, setViewport, setBounds, selectPlace } = useViewStore();
  const { data: placesData } = useMapPlaces();
  const { data: heatmapData } = useHeatmap();

  const zoom = viewport.zoom;
  const showHeatmap = zoom < HEATMAP_MAX_ZOOM;
  const showClusters = zoom >= HEATMAP_MAX_ZOOM && zoom < CLUSTER_MAX_ZOOM;
  const showPoints = zoom >= CLUSTER_MAX_ZOOM;

  // Create cluster index when places data changes
  const clusterIndex = useMemo(() => {
    if (!placesData?.features) return null;
    return createClusterIndex(placesData.features);
  }, [placesData?.features]);

  // Get clusters for current viewport
  const clusteredData = useMemo(() => {
    if (!clusterIndex || !bounds || !showClusters) {
      return { type: 'FeatureCollection' as const, features: [] };
    }

    const boundsArray: [number, number, number, number] = [
      bounds.sw[0],
      bounds.sw[1],
      bounds.ne[0],
      bounds.ne[1],
    ];

    const clusters = getClusters(clusterIndex, boundsArray, zoom);

    return {
      type: 'FeatureCollection' as const,
      features: clusters,
    };
  }, [clusterIndex, bounds, zoom, showClusters]);

  // Convert heatmap data to GeoJSON
  const heatmapGeoJSON = useMemo(() => {
    if (!heatmapData?.cells || !showHeatmap) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return heatmapToGeoJSON(heatmapData.cells);
  }, [heatmapData?.cells, showHeatmap]);

  // Point data for high zoom
  const pointsData = useMemo(() => {
    if (!placesData || !showPoints) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return placesData;
  }, [placesData, showPoints]);

  // Handle viewport changes and update bounds in sync
  const handleMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      setViewport({
        latitude: evt.viewState.latitude,
        longitude: evt.viewState.longitude,
        zoom: evt.viewState.zoom,
      });

      // Update bounds during move to keep clusters in sync with zoom
      const map = mapRef.current?.getMap();
      if (map) {
        const mapBounds = map.getBounds();
        if (mapBounds) {
          setBounds({
            sw: [mapBounds.getWest(), mapBounds.getSouth()],
            ne: [mapBounds.getEast(), mapBounds.getNorth()],
          });
        }
      }
    },
    [setViewport, setBounds]
  );

  // Also update bounds when map loads or stops moving
  const handleMoveEnd = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const mapBounds = map.getBounds();
    if (mapBounds) {
      setBounds({
        sw: [mapBounds.getWest(), mapBounds.getSouth()],
        ne: [mapBounds.getEast(), mapBounds.getNorth()],
      });
    }
  }, [setBounds]);

  // Handle click on a place or cluster
  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const feature = evt.features?.[0];
      if (!feature || !feature.properties) return;

      // Check if it's a cluster
      if (feature.properties['cluster'] && clusterIndex) {
        const clusterId = feature.properties['cluster_id'] as number;
        const expansionZoom = getClusterExpansionZoom(clusterIndex, clusterId);

        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        mapRef.current?.flyTo({
          center: coords,
          zoom: Math.min(expansionZoom, 17),
          duration: 500,
        });
        return;
      }

      // It's a point - select it
      const id = feature.properties['id'] ?? feature.id;
      if (id) {
        selectPlace(id as string);
      }
    },
    [selectPlace, clusterIndex]
  );

  // Interactive layer IDs based on current view mode
  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = [];
    if (showHeatmap) ids.push('heatmap-layer');
    if (showClusters) ids.push('clusters-layer', 'unclustered-point');
    if (showPoints) ids.push('places-layer');
    return ids;
  }, [showHeatmap, showClusters, showPoints]);

  return (
    <Map
      ref={mapRef}
      {...viewport}
      onMove={handleMove}
      onMoveEnd={handleMoveEnd}
      onLoad={handleMoveEnd}
      onClick={handleClick}
      mapStyle={MAP_STYLE}
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={interactiveLayerIds}
      style={{ width: '100%', height: '100%' }}
      cursor="pointer"
    >
      {/* Navigation controls */}
      <NavigationControl position="top-right" />

      {/* Heatmap layer (low zoom) */}
      {showHeatmap && (
        <Source id="heatmap" type="geojson" data={heatmapGeoJSON}>
          <Layer
            id="heatmap-layer"
            type="fill"
            paint={HEATMAP_FILL_PAINT}
          />
        </Source>
      )}

      {/* Clustered layer (medium zoom) */}
      {showClusters && (
        <Source id="clusters" type="geojson" data={clusteredData} tolerance={0}>
          {/* Cluster circles */}
          <Layer
            id="clusters-layer"
            type="circle"
            filter={['has', 'point_count']}
            paint={CLUSTER_LAYER_PAINT}
          />
          {/* Cluster count labels */}
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={CLUSTER_COUNT_LAYOUT}
            paint={CLUSTER_COUNT_PAINT}
          />
          {/* Unclustered points */}
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={POINT_LAYER_PAINT}
          />
        </Source>
      )}

      {/* Individual places layer (high zoom) */}
      {showPoints && (
        <Source id="places" type="geojson" data={pointsData}>
          <Layer
            id="places-layer"
            type="circle"
            paint={POINT_LAYER_PAINT}
          />
        </Source>
      )}
    </Map>
  );
}
