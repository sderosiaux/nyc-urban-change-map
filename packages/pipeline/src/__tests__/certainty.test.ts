/**
 * Tests for certainty derivation
 */

import { describe, it, expect } from 'vitest';
import { deriveCertainty, getCertaintyOpacity, shouldShowDashedBorder } from '../compute/certainty.js';
import type { RawEvent } from '../db/schema.js';

// Helper to create mock events
function createEvent(eventType: string): RawEvent {
  return {
    id: crypto.randomUUID(),
    placeId: 'place-1',
    sourceType: 'dob',
    sourceId: `src-${Math.random().toString(36).slice(2)}`,
    eventType,
    eventDate: '2024-01-15',
    description: null,
    status: null,
    rawData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('deriveCertainty', () => {
  it('should return "discussion" for empty events', () => {
    expect(deriveCertainty([])).toBe('discussion');
  });

  describe('certain events', () => {
    it('should return "certain" for construction_started', () => {
      const events = [createEvent('construction_started')];
      expect(deriveCertainty(events)).toBe('certain');
    });

    it('should return "certain" for construction_completed', () => {
      const events = [createEvent('construction_completed')];
      expect(deriveCertainty(events)).toBe('certain');
    });
  });

  describe('probable events', () => {
    it('should return "probable" for new_building', () => {
      const events = [createEvent('new_building')];
      expect(deriveCertainty(events)).toBe('probable');
    });

    it('should return "probable" for major_alteration', () => {
      const events = [createEvent('major_alteration')];
      expect(deriveCertainty(events)).toBe('probable');
    });

    it('should return "probable" for demolition', () => {
      const events = [createEvent('demolition')];
      expect(deriveCertainty(events)).toBe('probable');
    });

    it('should return "probable" for zap_approved', () => {
      const events = [createEvent('zap_approved')];
      expect(deriveCertainty(events)).toBe('probable');
    });

    it('should return "probable" for ulurp_approved', () => {
      const events = [createEvent('ulurp_approved')];
      expect(deriveCertainty(events)).toBe('probable');
    });
  });

  describe('discussion events', () => {
    it('should return "discussion" for ulurp_filed', () => {
      const events = [createEvent('ulurp_filed')];
      expect(deriveCertainty(events)).toBe('discussion');
    });

    it('should return "discussion" for zap_filed', () => {
      const events = [createEvent('zap_filed')];
      expect(deriveCertainty(events)).toBe('discussion');
    });
  });

  describe('priority hierarchy', () => {
    it('should prioritize "certain" over "probable"', () => {
      const events = [
        createEvent('new_building'),         // probable
        createEvent('construction_started'), // certain
      ];
      expect(deriveCertainty(events)).toBe('certain');
    });

    it('should prioritize "probable" over "discussion"', () => {
      const events = [
        createEvent('ulurp_filed'),    // discussion
        createEvent('zap_approved'),   // probable
      ];
      expect(deriveCertainty(events)).toBe('probable');
    });

    it('should prioritize "certain" over "discussion"', () => {
      const events = [
        createEvent('ulurp_filed'),           // discussion
        createEvent('construction_completed'), // certain
      ];
      expect(deriveCertainty(events)).toBe('certain');
    });
  });

  describe('unknown events', () => {
    it('should return "discussion" for unknown event types', () => {
      const events = [createEvent('unknown_event')];
      expect(deriveCertainty(events)).toBe('discussion');
    });
  });
});

describe('getCertaintyOpacity', () => {
  it('should return 0.4 for discussion', () => {
    expect(getCertaintyOpacity('discussion')).toBe(0.4);
  });

  it('should return 0.7 for probable', () => {
    expect(getCertaintyOpacity('probable')).toBe(0.7);
  });

  it('should return 1.0 for certain', () => {
    expect(getCertaintyOpacity('certain')).toBe(1.0);
  });
});

describe('shouldShowDashedBorder', () => {
  it('should return true for discussion', () => {
    expect(shouldShowDashedBorder('discussion')).toBe(true);
  });

  it('should return false for probable', () => {
    expect(shouldShowDashedBorder('probable')).toBe(false);
  });

  it('should return false for certain', () => {
    expect(shouldShowDashedBorder('certain')).toBe(false);
  });
});
