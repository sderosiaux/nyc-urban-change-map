/**
 * View state store - Map viewport, filters, selections
 * URL hash sync: #@lat,lng,zoom or #@lat,lng,zoom/place/id
 */

import { create } from 'zustand';
import type { TimeMode, Bounds } from '@ucm/shared';
import { NYC_CENTER, NYC_DEFAULT_ZOOM } from '@ucm/shared';

interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

// Parse URL hash to extract viewport and placeId
function parseUrlHash(): { viewport?: Partial<Viewport>; placeId?: string } {
  if (typeof window === 'undefined') return {};

  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#@')) return {};

  const result: { viewport?: Partial<Viewport>; placeId?: string } = {};

  // Format: #@lat,lng,zoom or #@lat,lng,zoom/place/id
  const match = hash.match(/^#@(-?[\d.]+),(-?[\d.]+),([\d.]+)(?:\/place\/(.+))?$/);
  if (match && match[1] && match[2] && match[3]) {
    result.viewport = {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      zoom: parseFloat(match[3]),
    };
    if (match[4]) {
      result.placeId = match[4];
    }
  }

  return result;
}

// Update URL hash from viewport state (debounced externally)
function updateUrlHash(viewport: Viewport, placeId: string | null) {
  if (typeof window === 'undefined') return;

  const { latitude, longitude, zoom } = viewport;
  const base = `#@${latitude.toFixed(5)},${longitude.toFixed(5)},${zoom.toFixed(1)}`;
  const hash = placeId ? `${base}/place/${placeId}` : base;

  // Use replaceState to avoid polluting browser history
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash);
  }
}

// Get initial state from URL or defaults
function getInitialState() {
  const { viewport, placeId } = parseUrlHash();
  return {
    viewport: {
      latitude: viewport?.latitude ?? NYC_CENTER[1],
      longitude: viewport?.longitude ?? NYC_CENTER[0],
      zoom: viewport?.zoom ?? NYC_DEFAULT_ZOOM,
    },
    selectedPlaceId: placeId ?? null,
    detailPanelOpen: !!placeId,
  };
}

const initialState = getInitialState();

interface ViewStore {
  // Viewport
  viewport: Viewport;
  bounds: Bounds | null;

  // Time control
  timeMode: TimeMode;
  selectedYear: number;

  // Intensity filter
  minIntensity: number;

  // Selection
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;

  // UI state
  detailPanelOpen: boolean;

  // Actions
  setViewport: (viewport: Partial<Viewport>) => void;
  setBounds: (bounds: Bounds) => void;
  setTimeMode: (mode: TimeMode) => void;
  setSelectedYear: (year: number) => void;
  setMinIntensity: (intensity: number) => void;
  selectPlace: (id: string | null) => void;
  hoverPlace: (id: string | null) => void;
  openDetailPanel: () => void;
  closeDetailPanel: () => void;
}

// Debounce helper for URL updates
let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedUrlUpdate(viewport: Viewport, placeId: string | null) {
  if (urlUpdateTimeout) clearTimeout(urlUpdateTimeout);
  urlUpdateTimeout = setTimeout(() => {
    updateUrlHash(viewport, placeId);
  }, 300);
}

export const useViewStore = create<ViewStore>((set, get) => ({
  // Initial state from URL or defaults
  viewport: initialState.viewport,
  bounds: null,
  timeMode: 'now',
  selectedYear: new Date().getFullYear(),
  minIntensity: 0,
  selectedPlaceId: initialState.selectedPlaceId,
  hoveredPlaceId: null,
  detailPanelOpen: initialState.detailPanelOpen,

  // Actions
  setViewport: (viewport) =>
    set((state) => {
      const newViewport = { ...state.viewport, ...viewport };
      debouncedUrlUpdate(newViewport, state.selectedPlaceId);
      return { viewport: newViewport };
    }),

  setBounds: (bounds) => set({ bounds }),

  setTimeMode: (timeMode) => set({ timeMode }),

  setSelectedYear: (selectedYear) => set({ selectedYear }),

  setMinIntensity: (minIntensity) => set({ minIntensity }),

  selectPlace: (id) => {
    const state = get();
    updateUrlHash(state.viewport, id);
    set({
      selectedPlaceId: id,
      detailPanelOpen: id !== null,
    });
  },

  hoverPlace: (id) => set({ hoveredPlaceId: id }),

  openDetailPanel: () => set({ detailPanelOpen: true }),

  closeDetailPanel: () => {
    const state = get();
    updateUrlHash(state.viewport, null);
    set({
      detailPanelOpen: false,
      selectedPlaceId: null,
    });
  },
}));
