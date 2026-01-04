/**
 * Tests for main transformation computation
 */

import { describe, it, expect } from 'vitest';
import { computeTransformationState, toDbInsert } from '../compute/transformation.js';
import type { Place, RawEvent } from '../db/schema.js';

// Helper to create mock place
function createPlace(id = 'place-1'): Place {
  return {
    id,
    geometry: { type: 'Point', coordinates: [-73.95, 40.75] },
    bin: '1234567',
    bbl: '1000010001',
    address: '123 Test St',
    borough: 'Manhattan',
    neighborhood: 'Midtown',
    ntaCode: 'MN17',
    ntaName: 'Midtown',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Helper to create mock events
function createEvent(
  eventType: string,
  eventDate = '2024-01-15',
  placeId = 'place-1'
): RawEvent {
  return {
    id: crypto.randomUUID(),
    placeId,
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

describe('computeTransformationState', () => {
  it('should handle empty events', () => {
    const place = createPlace();
    const result = computeTransformationState({ place, events: [] });

    expect(result.placeId).toBe('place-1');
    expect(result.intensity).toBe(0);
    expect(result.certainty).toBe('discussion');
    expect(result.nature).toBe('mixed');
    expect(result.eventCount).toBe(0);
    expect(result.firstActivity).toBeNull();
    expect(result.lastActivity).toBeNull();
  });

  it('should compute intensity from events', () => {
    const place = createPlace();
    const events = [
      createEvent('new_building'),  // 50 points
      createEvent('scaffold'),       // 3 points
    ];
    const result = computeTransformationState({ place, events });

    expect(result.intensity).toBe(53);
  });

  it('should derive certainty from events', () => {
    const place = createPlace();
    const events = [createEvent('construction_started')];
    const result = computeTransformationState({ place, events });

    expect(result.certainty).toBe('certain');
  });

  it('should track event count', () => {
    const place = createPlace();
    const events = [
      createEvent('new_building'),
      createEvent('scaffold'),
      createEvent('construction_started'),
    ];
    const result = computeTransformationState({ place, events });

    expect(result.eventCount).toBe(3);
  });

  it('should calculate activity dates', () => {
    const place = createPlace();
    const events = [
      createEvent('scaffold', '2024-01-01'),
      createEvent('new_building', '2024-06-15'),
      createEvent('construction_started', '2024-03-10'),
    ];
    const result = computeTransformationState({ place, events });

    expect(result.firstActivity?.toISOString().slice(0, 10)).toBe('2024-01-01');
    expect(result.lastActivity?.toISOString().slice(0, 10)).toBe('2024-06-15');
  });

  it('should generate headlines', () => {
    const place = createPlace();
    const events = [createEvent('new_building')];
    const result = computeTransformationState({ place, events });

    expect(result.headline).toBeTruthy();
    expect(typeof result.headline).toBe('string');
  });

  it('should generate one-liner', () => {
    const place = createPlace();
    const events = [createEvent('new_building')];
    const result = computeTransformationState({ place, events });

    expect(result.oneLiner).toBeTruthy();
  });
});

describe('toDbInsert', () => {
  it('should convert computed state to DB insert format', () => {
    const place = createPlace();
    const events = [createEvent('new_building', '2024-06-15')];
    const computed = computeTransformationState({ place, events });
    const dbInsert = toDbInsert(computed);

    expect(dbInsert.placeId).toBe('place-1');
    expect(dbInsert.intensity).toBe(50);
    expect(dbInsert.certainty).toBe('probable');
    expect(typeof dbInsert.headline).toBe('string');
    expect(dbInsert.eventCount).toBe(1);
  });

  it('should format dates as ISO strings', () => {
    const place = createPlace();
    const events = [createEvent('new_building', '2024-06-15')];
    const computed = computeTransformationState({ place, events });
    const dbInsert = toDbInsert(computed);

    expect(dbInsert.firstActivity).toBe('2024-06-15');
    expect(dbInsert.lastActivity).toBe('2024-06-15');
  });

  it('should handle null dates', () => {
    const place = createPlace();
    const computed = computeTransformationState({ place, events: [] });
    const dbInsert = toDbInsert(computed);

    expect(dbInsert.firstActivity).toBeNull();
    expect(dbInsert.lastActivity).toBeNull();
    expect(dbInsert.disruptionStart).toBeNull();
  });
});

describe('integration scenarios', () => {
  it('should handle a typical new development', () => {
    const place = createPlace();
    const events = [
      createEvent('ulurp_filed', '2023-06-01'),
      createEvent('ulurp_approved', '2023-12-01'),
      createEvent('demolition', '2024-02-01'),
      createEvent('new_building', '2024-03-01'),
      createEvent('construction_started', '2024-04-01'),
    ];
    const result = computeTransformationState({ place, events });

    // Should have high intensity (demolition + new_building capped at 100)
    expect(result.intensity).toBe(100);
    // Should be certain (construction_started)
    expect(result.certainty).toBe('certain');
    // Should have 5 events
    expect(result.eventCount).toBe(5);
  });

  it('should handle a minor renovation', () => {
    const place = createPlace();
    const events = [
      createEvent('minor_alteration', '2024-01-15'),
      createEvent('scaffold', '2024-02-01'),
    ];
    const result = computeTransformationState({ place, events });

    // Low intensity
    expect(result.intensity).toBe(13); // 10 + 3
    // Probable (minor_alteration doesn't indicate certainty on its own)
    expect(result.certainty).toBe('discussion');
  });

  it('should handle a proposed development', () => {
    const place = createPlace();
    const events = [
      createEvent('zap_filed', '2024-01-01'),
    ];
    const result = computeTransformationState({ place, events });

    // Low intensity
    expect(result.intensity).toBe(8); // zap_filed = 8
    // Discussion (only filed, not approved)
    expect(result.certainty).toBe('discussion');
  });
});
