/**
 * Certainty derivation
 * From SPEC_REFINED.md: "The user must FEEL immediately: 'it could happen' vs
 * 'it's very likely' vs 'it's already happening'"
 */

import type { Certainty, EventType } from '@ucm/shared';
import type { RawEvent } from '../db/schema.js';

// Events that indicate work is certain (in progress or completed)
const CERTAIN_EVENTS: EventType[] = [
  'construction_started',
  'construction_completed',
];

// Events that indicate work is probable (approved but not started)
const PROBABLE_EVENTS: EventType[] = [
  'new_building',
  'major_alteration',
  'demolition',
  'zap_approved',
  'ulurp_approved',
  'ceqr_eis_final',     // Final EIS means project is very likely
  'ceqr_completed',     // CEQR completed means ready to proceed
];

// Events that indicate work is in discussion (filed but not approved)
const DISCUSSION_EVENTS: EventType[] = [
  'ulurp_filed',
  'zap_filed',
  'ceqr_eas',           // Initial environmental assessment
  'ceqr_eis_draft',     // Draft EIS still being reviewed
];

/**
 * Derive the certainty level from a set of events
 * Hierarchy: certain > probable > discussion
 */
export function deriveCertainty(events: RawEvent[]): Certainty {
  if (events.length === 0) return 'discussion';

  const eventTypes = new Set(events.map(e => e.eventType as EventType));

  // Check for certain signals first (highest priority)
  for (const type of CERTAIN_EVENTS) {
    if (eventTypes.has(type)) {
      return 'certain';
    }
  }

  // Check for probable signals
  for (const type of PROBABLE_EVENTS) {
    if (eventTypes.has(type)) {
      return 'probable';
    }
  }

  // Check for discussion signals
  for (const type of DISCUSSION_EVENTS) {
    if (eventTypes.has(type)) {
      return 'discussion';
    }
  }

  // Default to discussion for unknown event types
  return 'discussion';
}

/**
 * Get opacity value for certainty visualization
 */
export function getCertaintyOpacity(certainty: Certainty): number {
  switch (certainty) {
    case 'discussion': return 0.4;
    case 'probable': return 0.7;
    case 'certain': return 1.0;
  }
}

/**
 * Check if certainty should show dashed border
 */
export function shouldShowDashedBorder(certainty: Certainty): boolean {
  return certainty === 'discussion';
}
