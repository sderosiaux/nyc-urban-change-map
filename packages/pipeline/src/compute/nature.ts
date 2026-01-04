/**
 * Transformation nature derivation
 * Determines what kind of change is happening at a place
 */

import type { TransformationNature, EventType } from '@ucm/shared';
import { countBy } from '@ucm/shared';
import type { RawEvent } from '../db/schema.js';

// Map event types to transformation nature
const NATURE_MAPPING: Record<EventType, TransformationNature | null> = {
  // Densification
  new_building: 'densification',

  // Demolition
  demolition: 'demolition',

  // Renovation
  major_alteration: 'renovation',
  minor_alteration: 'renovation',
  mechanical: 'renovation',
  plumbing: 'renovation',

  // Infrastructure
  capital_project: 'infrastructure',

  // Neutral (don't influence nature)
  scaffold: null,
  equipment_work: null,
  ulurp_filed: null,
  ulurp_approved: null,
  ulurp_denied: null,
  zap_filed: null,
  zap_approved: null,
  ceqr_eas: null,
  ceqr_eis_draft: null,
  ceqr_eis_final: null,
  ceqr_completed: null,
  construction_started: null,
  construction_completed: null,
  other: null,
};

// Weight each nature type for determining dominant nature
export const NATURE_WEIGHTS: Record<TransformationNature, number> = {
  densification: 5,  // New buildings are most significant
  demolition: 4,
  infrastructure: 3,
  renovation: 2,
  mixed: 1,
};

/**
 * Derive the dominant nature of transformation from events
 */
export function deriveNature(events: RawEvent[]): TransformationNature {
  if (events.length === 0) return 'mixed';

  // Count occurrences of each nature
  const natureCounts = new Map<TransformationNature, number>();

  for (const event of events) {
    const eventType = event.eventType as EventType;
    const nature = NATURE_MAPPING[eventType];

    if (nature) {
      natureCounts.set(nature, (natureCounts.get(nature) ?? 0) + 1);
    }
  }

  // If no nature signals found, return mixed
  if (natureCounts.size === 0) return 'mixed';

  // If multiple natures present, check if one dominates
  if (natureCounts.size > 1) {
    // Calculate weighted scores
    let maxScore = 0;
    let dominantNature: TransformationNature = 'mixed';

    for (const [nature, count] of natureCounts) {
      const score = count * NATURE_WEIGHTS[nature];
      if (score > maxScore) {
        maxScore = score;
        dominantNature = nature;
      }
    }

    // If no clear dominant (score diff < 3), return mixed
    const scores = Array.from(natureCounts.entries())
      .map(([n, c]) => c * NATURE_WEIGHTS[n])
      .sort((a, b) => b - a);

    if (scores.length > 1 && scores[0]! - scores[1]! < 3) {
      return 'mixed';
    }

    return dominantNature;
  }

  // Single nature type
  return natureCounts.keys().next().value!;
}

/**
 * Get human-readable label for nature
 */
export function getNatureLabel(nature: TransformationNature): string {
  const labels: Record<TransformationNature, string> = {
    densification: 'Densification',
    renovation: 'Rénovation',
    demolition: 'Démolition',
    infrastructure: 'Infrastructure',
    mixed: 'Mixte',
  };
  return labels[nature];
}

/**
 * Get icon name for nature (for UI)
 */
export function getNatureIcon(nature: TransformationNature): string {
  const icons: Record<TransformationNature, string> = {
    densification: 'building',
    renovation: 'wrench',
    demolition: 'trash',
    infrastructure: 'road',
    mixed: 'layers',
  };
  return icons[nature];
}
