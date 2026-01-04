/**
 * Tests for view store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useViewStore } from '../stores/viewStore';

describe('viewStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useViewStore.setState({
      viewport: {
        latitude: 40.7128,
        longitude: -74.006,
        zoom: 12,
      },
      bounds: null,
      timeMode: 'now',
      selectedYear: new Date().getFullYear(),
      minIntensity: 0,
      selectedPlaceId: null,
      hoveredPlaceId: null,
      detailPanelOpen: false,
    });
  });

  describe('viewport', () => {
    it('should update viewport', () => {
      const { setViewport } = useViewStore.getState();

      setViewport({ latitude: 40.8, longitude: -73.95, zoom: 15 });

      const { viewport } = useViewStore.getState();
      expect(viewport.latitude).toBe(40.8);
      expect(viewport.longitude).toBe(-73.95);
      expect(viewport.zoom).toBe(15);
    });

    it('should partially update viewport', () => {
      const { setViewport } = useViewStore.getState();

      setViewport({ zoom: 16 });

      const { viewport } = useViewStore.getState();
      expect(viewport.zoom).toBe(16);
      expect(viewport.latitude).toBe(40.7128); // unchanged
    });
  });

  describe('bounds', () => {
    it('should update bounds', () => {
      const { setBounds } = useViewStore.getState();
      const newBounds = {
        sw: [-74.1, 40.6] as [number, number],
        ne: [-73.9, 40.8] as [number, number],
      };

      setBounds(newBounds);

      const { bounds } = useViewStore.getState();
      expect(bounds).toEqual(newBounds);
    });
  });

  describe('time mode', () => {
    it('should update time mode', () => {
      const { setTimeMode } = useViewStore.getState();

      setTimeMode('future');

      const { timeMode } = useViewStore.getState();
      expect(timeMode).toBe('future');
    });
  });

  describe('selected year', () => {
    it('should update selected year', () => {
      const { setSelectedYear } = useViewStore.getState();

      setSelectedYear(2030);

      const { selectedYear } = useViewStore.getState();
      expect(selectedYear).toBe(2030);
    });
  });

  describe('intensity filter', () => {
    it('should update min intensity', () => {
      const { setMinIntensity } = useViewStore.getState();

      setMinIntensity(50);

      const { minIntensity } = useViewStore.getState();
      expect(minIntensity).toBe(50);
    });
  });

  describe('place selection', () => {
    it('should select place and open detail panel', () => {
      const { selectPlace } = useViewStore.getState();

      selectPlace('place-123');

      const state = useViewStore.getState();
      expect(state.selectedPlaceId).toBe('place-123');
      expect(state.detailPanelOpen).toBe(true);
    });

    it('should deselect place and close detail panel', () => {
      const { selectPlace } = useViewStore.getState();

      selectPlace('place-123');
      selectPlace(null);

      const state = useViewStore.getState();
      expect(state.selectedPlaceId).toBeNull();
      expect(state.detailPanelOpen).toBe(false);
    });
  });

  describe('place hover', () => {
    it('should update hovered place', () => {
      const { hoverPlace } = useViewStore.getState();

      hoverPlace('place-456');

      const { hoveredPlaceId } = useViewStore.getState();
      expect(hoveredPlaceId).toBe('place-456');
    });

    it('should clear hovered place', () => {
      const { hoverPlace } = useViewStore.getState();

      hoverPlace('place-456');
      hoverPlace(null);

      const { hoveredPlaceId } = useViewStore.getState();
      expect(hoveredPlaceId).toBeNull();
    });
  });

  describe('detail panel', () => {
    it('should open detail panel', () => {
      const { openDetailPanel } = useViewStore.getState();

      openDetailPanel();

      const { detailPanelOpen } = useViewStore.getState();
      expect(detailPanelOpen).toBe(true);
    });

    it('should close detail panel and clear selection', () => {
      const { selectPlace, closeDetailPanel } = useViewStore.getState();

      selectPlace('place-123');
      closeDetailPanel();

      const state = useViewStore.getState();
      expect(state.detailPanelOpen).toBe(false);
      expect(state.selectedPlaceId).toBeNull();
    });
  });
});
