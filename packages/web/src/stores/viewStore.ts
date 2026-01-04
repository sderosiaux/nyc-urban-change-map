/**
 * View state store - Map viewport, filters, selections
 */

import { create } from 'zustand';
import type { TimeMode, Bounds } from '@ucm/shared';
import { NYC_CENTER, NYC_DEFAULT_ZOOM } from '@ucm/shared';

interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

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

export const useViewStore = create<ViewStore>((set) => ({
  // Initial state
  viewport: {
    latitude: NYC_CENTER[1],
    longitude: NYC_CENTER[0],
    zoom: NYC_DEFAULT_ZOOM,
  },
  bounds: null,
  timeMode: 'now',
  selectedYear: new Date().getFullYear(),
  minIntensity: 0,
  selectedPlaceId: null,
  hoveredPlaceId: null,
  detailPanelOpen: false,

  // Actions
  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),

  setBounds: (bounds) => set({ bounds }),

  setTimeMode: (timeMode) => set({ timeMode }),

  setSelectedYear: (selectedYear) => set({ selectedYear }),

  setMinIntensity: (minIntensity) => set({ minIntensity }),

  selectPlace: (id) =>
    set({
      selectedPlaceId: id,
      detailPanelOpen: id !== null,
    }),

  hoverPlace: (id) => set({ hoveredPlaceId: id }),

  openDetailPanel: () => set({ detailPanelOpen: true }),

  closeDetailPanel: () =>
    set({
      detailPanelOpen: false,
      selectedPlaceId: null,
    }),
}));
