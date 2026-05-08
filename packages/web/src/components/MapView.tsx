/**
 * MapView - Main map component with MapLibre GL + OpenFreeMap tiles
 * Supports heatmap (low zoom), clusters (medium zoom), and points (high zoom)
 */

import { useCallback, useRef, useMemo } from 'react';
import { Map, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type {
  MapRef,
  ViewStateChangeEvent,
  MapLayerMouseEvent,
  LayerProps,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useViewStore } from '../stores/viewStore';
import { useMapPlaces, useHeatmap } from '../hooks/useMapData';
import { createClusterIndex, getClusters, getClusterExpansionZoom } from '../utils/clustering';
import type { HeatmapCell } from '@ucm/shared';

// OpenFreeMap positron style (light theme, OSM-based vector tiles, no token)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// Zoom thresholds
const HEATMAP_MAX_ZOOM = 12;
const CLUSTER_MAX_ZOOM = 16;

// Fonts shipped by OpenFreeMap positron glyphs
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_REGULAR = ['Noto Sans Regular'];

const POINT_LAYER: LayerProps = {
  id: 'places-layer',
  type: 'circle',
  paint: {
    'circle-radius': [
      'case',
      ['==', ['get', 'hasZap'], true],
      16,
      ['interpolate', ['linear'], ['get', 'intensity'], 0, 6, 50, 12, 100, 22],
    ],
    'circle-color': [
      'case',
      ['==', ['get', 'hasZap'], true],
      '#3b82f6',
      [
        'interpolate',
        ['linear'],
        ['get', 'intensity'],
        0,
        '#94a3b8',
        30,
        '#fbbf24',
        60,
        '#f97316',
        80,
        '#dc2626',
      ],
    ],
    'circle-opacity': [
      'match',
      ['get', 'certainty'],
      'discussion',
      0.9,
      'probable',
      0.85,
      'certain',
      1.0,
      0.7,
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
  },
};

const UNCLUSTERED_POINT_LAYER: LayerProps = {
  ...POINT_LAYER,
  id: 'unclustered-point',
  filter: ['!', ['has', 'point_count']],
};

const ZAP_LABEL_LAYER: LayerProps = {
  id: 'zap-label',
  type: 'symbol',
  filter: ['==', ['get', 'hasZap'], true],
  layout: {
    'text-field': '?',
    'text-font': FONT_BOLD,
    'text-size': 14,
    'text-anchor': 'center',
    'text-allow-overlap': true,
    'icon-allow-overlap': true,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': 'rgba(0,0,0,0.3)',
    'text-halo-width': 0.5,
  },
};

const UNCLUSTERED_ZAP_LABEL_LAYER: LayerProps = {
  ...ZAP_LABEL_LAYER,
  id: 'unclustered-zap-label',
  filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'hasZap'], true]],
};

const CLUSTER_LAYER: LayerProps = {
  id: 'clusters-layer',
  type: 'circle',
  filter: ['has', 'point_count'],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 15, 10, 25, 100, 40],
    'circle-color': [
      'interpolate',
      ['linear'],
      ['get', 'avgIntensity'],
      0,
      '#94a3b8',
      30,
      '#fbbf24',
      60,
      '#f97316',
      80,
      '#dc2626',
    ],
    'circle-opacity': 0.8,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
  },
};

const CLUSTER_COUNT_LAYER: LayerProps = {
  id: 'cluster-count',
  type: 'symbol',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': FONT_REGULAR,
    'text-size': 12,
    'text-anchor': 'center',
    'text-allow-overlap': true,
    'icon-allow-overlap': true,
  },
  paint: {
    'text-color': '#ffffff',
  },
};

const HEATMAP_LAYER: LayerProps = {
  id: 'heatmap-layer',
  type: 'fill',
  paint: {
    'fill-color': [
      'interpolate',
      ['linear'],
      ['get', 'avgIntensity'],
      0,
      'rgba(148, 163, 184, 0.3)',
      30,
      'rgba(251, 191, 36, 0.4)',
      60,
      'rgba(249, 115, 22, 0.5)',
      80,
      'rgba(220, 38, 38, 0.6)',
    ],
    'fill-outline-color': [
      'interpolate',
      ['linear'],
      ['get', 'avgIntensity'],
      0,
      'rgba(148, 163, 184, 0.5)',
      30,
      'rgba(251, 191, 36, 0.6)',
      60,
      'rgba(249, 115, 22, 0.7)',
      80,
      'rgba(220, 38, 38, 0.8)',
    ],
  },
};

function heatmapToGeoJSON(cells: HeatmapCell[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature' as const,
      id: cell.h3Index,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[...cell.boundary, cell.boundary[0]!]],
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

  const clusterIndex = useMemo(() => {
    if (!placesData?.features) return null;
    return createClusterIndex(placesData.features);
  }, [placesData?.features]);

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

  const heatmapGeoJSON = useMemo(() => {
    if (!heatmapData?.cells || !showHeatmap) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return heatmapToGeoJSON(heatmapData.cells);
  }, [heatmapData?.cells, showHeatmap]);

  const pointsData = useMemo(() => {
    if (!placesData || !showPoints) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return placesData;
  }, [placesData, showPoints]);

  const handleMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      setViewport({
        latitude: evt.viewState.latitude,
        longitude: evt.viewState.longitude,
        zoom: evt.viewState.zoom,
      });

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
    [setViewport, setBounds],
  );

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

  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const feature = evt.features?.[0];
      if (!feature?.properties) return;

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

      const id = feature.properties['id'] ?? feature.id;
      if (id) {
        selectPlace(id as string);
      }
    },
    [selectPlace, clusterIndex],
  );

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
      interactiveLayerIds={interactiveLayerIds}
      style={{ width: '100%', height: '100%' }}
      cursor="pointer"
    >
      <NavigationControl position="top-right" />

      {showHeatmap && (
        <Source id="heatmap" type="geojson" data={heatmapGeoJSON}>
          <Layer {...HEATMAP_LAYER} />
        </Source>
      )}

      {showClusters && (
        <Source id="clusters" type="geojson" data={clusteredData} tolerance={0}>
          <Layer {...CLUSTER_LAYER} />
          <Layer {...CLUSTER_COUNT_LAYER} />
          <Layer {...UNCLUSTERED_POINT_LAYER} />
          <Layer {...UNCLUSTERED_ZAP_LABEL_LAYER} />
        </Source>
      )}

      {showPoints && (
        <Source id="places" type="geojson" data={pointsData}>
          <Layer {...POINT_LAYER} />
          <Layer {...ZAP_LABEL_LAYER} />
        </Source>
      )}
    </Map>
  );
}
