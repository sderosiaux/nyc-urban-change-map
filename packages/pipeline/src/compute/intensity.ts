/**
 * Intensity score calculation
 * From SPEC_INITIALE.md Section 8.1
 */

import type { EventType } from '@ucm/shared';
import { INTENSITY_WEIGHTS, MAX_INTENSITY } from '@ucm/shared';
import type { RawEvent } from '../db/schema.js';

/**
 * Calculate the transformation intensity score for a set of events
 * Score ranges from 0-100
 */
export function computeIntensity(events: RawEvent[]): number {
  if (events.length === 0) return 0;

  let score = 0;
  const seenTypes = new Set<string>();

  for (const event of events) {
    const eventType = event.eventType as EventType;
    const weight = INTENSITY_WEIGHTS[eventType] ?? 0;

    // Minor alterations (A2) are cumulative - each one adds to score
    if (eventType === 'minor_alteration') {
      score += weight;
    }
    // Other types: only count once (avoid double-counting)
    else if (!seenTypes.has(eventType)) {
      score += weight;
      seenTypes.add(eventType);
    }
  }

  return Math.min(score, MAX_INTENSITY);
}

/**
 * Get intensity level label for display
 */
export function getIntensityLabel(intensity: number): string {
  if (intensity < 20) return 'Faible';
  if (intensity < 50) return 'Modérée';
  if (intensity < 80) return 'Élevée';
  return 'Très élevée';
}

/**
 * Get CSS color for intensity visualization
 */
export function getIntensityColor(intensity: number): string {
  if (intensity < 30) return '#94a3b8';  // slate-400
  if (intensity < 60) return '#fbbf24';  // amber-400
  if (intensity < 80) return '#f97316';  // orange-500
  return '#dc2626';  // red-600
}
