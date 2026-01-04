/**
 * Tests for intensity computation
 */

import { describe, it, expect } from 'vitest';
import { computeIntensity, getIntensityLabel, getIntensityColor } from '../compute/intensity.js';
import type { RawEvent } from '../db/schema.js';

// Helper to create mock events
function createEvent(eventType: string, eventDate = '2024-01-15'): RawEvent {
  return {
    id: crypto.randomUUID(),
    placeId: 'place-1',
    sourceType: 'dob',
    sourceId: `src-${Math.random().toString(36).slice(2)}`,
    eventType,
    eventDate,
    description: null,
    status: null,
    rawData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('computeIntensity', () => {
  it('should return 0 for empty events array', () => {
    expect(computeIntensity([])).toBe(0);
  });

  it('should compute intensity for new_building event (50 points)', () => {
    const events = [createEvent('new_building')];
    expect(computeIntensity(events)).toBe(50);
  });

  it('should compute intensity for demolition event (35 points)', () => {
    const events = [createEvent('demolition')];
    expect(computeIntensity(events)).toBe(35);
  });

  it('should compute intensity for major_alteration event (30 points)', () => {
    const events = [createEvent('major_alteration')];
    expect(computeIntensity(events)).toBe(30);
  });

  it('should combine different event types', () => {
    const events = [
      createEvent('new_building'), // 50
      createEvent('demolition'),   // 35
    ];
    expect(computeIntensity(events)).toBe(85);
  });

  it('should not double-count same event type (except minor_alteration)', () => {
    const events = [
      createEvent('new_building'),
      createEvent('new_building'),
      createEvent('new_building'),
    ];
    expect(computeIntensity(events)).toBe(50); // Only counted once
  });

  it('should cumulate minor_alteration events', () => {
    const events = [
      createEvent('minor_alteration'), // 10
      createEvent('minor_alteration'), // 10
      createEvent('minor_alteration'), // 10
    ];
    expect(computeIntensity(events)).toBe(30); // 3 * 10 = 30
  });

  it('should cap at MAX_INTENSITY (100)', () => {
    const events = [
      createEvent('new_building'),     // 50
      createEvent('demolition'),       // 35
      createEvent('major_alteration'), // 30
    ];
    expect(computeIntensity(events)).toBe(100); // Capped at 100
  });

  it('should handle scaffold events (3 points)', () => {
    const events = [createEvent('scaffold')];
    expect(computeIntensity(events)).toBe(3);
  });

  it('should handle unknown event types gracefully (0 points)', () => {
    const events = [createEvent('unknown_type')];
    expect(computeIntensity(events)).toBe(0);
  });
});

describe('getIntensityLabel', () => {
  it('should return "Faible" for low intensity', () => {
    expect(getIntensityLabel(0)).toBe('Faible');
    expect(getIntensityLabel(19)).toBe('Faible');
  });

  it('should return "Modérée" for moderate intensity', () => {
    expect(getIntensityLabel(20)).toBe('Modérée');
    expect(getIntensityLabel(49)).toBe('Modérée');
  });

  it('should return "Élevée" for high intensity', () => {
    expect(getIntensityLabel(50)).toBe('Élevée');
    expect(getIntensityLabel(79)).toBe('Élevée');
  });

  it('should return "Très élevée" for very high intensity', () => {
    expect(getIntensityLabel(80)).toBe('Très élevée');
    expect(getIntensityLabel(100)).toBe('Très élevée');
  });
});

describe('getIntensityColor', () => {
  it('should return slate for low intensity', () => {
    expect(getIntensityColor(0)).toBe('#94a3b8');
    expect(getIntensityColor(29)).toBe('#94a3b8');
  });

  it('should return amber for moderate intensity', () => {
    expect(getIntensityColor(30)).toBe('#fbbf24');
    expect(getIntensityColor(59)).toBe('#fbbf24');
  });

  it('should return orange for high intensity', () => {
    expect(getIntensityColor(60)).toBe('#f97316');
    expect(getIntensityColor(79)).toBe('#f97316');
  });

  it('should return red for very high intensity', () => {
    expect(getIntensityColor(80)).toBe('#dc2626');
    expect(getIntensityColor(100)).toBe('#dc2626');
  });
});
