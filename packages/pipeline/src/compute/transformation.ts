/**
 * Main transformation state computation
 * Combines intensity, certainty, nature, phases, and narratives
 */

import type { Place, RawEvent, NewTransformationState } from '../db/schema.js';
import { computeIntensity } from './intensity.js';
import { deriveCertainty } from './certainty.js';
import { deriveNature } from './nature.js';
import { estimateImpactPhases, type ProjectStatus } from './phases.js';
import { generateNarratives } from './narratives.js';

export interface TransformationInput {
  place: Place;
  events: RawEvent[];
}

export interface ComputedTransformationState {
  placeId: string;
  intensity: number;
  nature: string;
  certainty: string;
  headline: string | null;
  oneLiner: string | null;
  disruptionSummary: string | null;
  disruptionStart: Date | null;
  disruptionEnd: Date | null;
  visibleChangeDate: Date | null;
  usageChangeDate: Date | null;
  isEstimatedStart: boolean;
  isEstimatedEnd: boolean;
  approvalDate: Date | null;
  permitExpiration: Date | null;
  projectStatus: ProjectStatus;
  eventCount: number;
  firstActivity: Date | null;
  lastActivity: Date | null;
}

/**
 * Compute the complete transformation state for a place
 */
export function computeTransformationState(input: TransformationInput): ComputedTransformationState {
  const { place, events } = input;

  // If no events, return minimal state
  if (events.length === 0) {
    return {
      placeId: place.id,
      intensity: 0,
      nature: 'mixed',
      certainty: 'discussion',
      headline: null,
      oneLiner: null,
      disruptionSummary: null,
      disruptionStart: null,
      disruptionEnd: null,
      visibleChangeDate: null,
      usageChangeDate: null,
      isEstimatedStart: false,
      isEstimatedEnd: false,
      approvalDate: null,
      permitExpiration: null,
      projectStatus: 'planning',
      eventCount: 0,
      firstActivity: null,
      lastActivity: null,
    };
  }

  // Compute each component
  const intensity = computeIntensity(events);
  const certainty = deriveCertainty(events);
  const nature = deriveNature(events);
  const phases = estimateImpactPhases(events);
  const narratives = generateNarratives({ events, nature, certainty, phases });

  // Calculate activity dates
  const eventDates = events.map(e => new Date(e.eventDate));
  const firstActivity = new Date(Math.min(...eventDates.map(d => d.getTime())));
  const lastActivity = new Date(Math.max(...eventDates.map(d => d.getTime())));

  return {
    placeId: place.id,
    intensity,
    nature,
    certainty,
    headline: narratives.headline,
    oneLiner: narratives.oneLiner,
    disruptionSummary: narratives.disruptionSummary,
    disruptionStart: phases.disruptionStart,
    disruptionEnd: phases.disruptionEnd,
    visibleChangeDate: phases.visibleChangeDate,
    usageChangeDate: phases.usageChangeDate,
    isEstimatedStart: phases.isEstimatedStart,
    isEstimatedEnd: phases.isEstimatedEnd,
    approvalDate: phases.approvalDate,
    permitExpiration: phases.permitExpiration,
    projectStatus: phases.projectStatus,
    eventCount: events.length,
    firstActivity,
    lastActivity,
  };
}

/**
 * Convert computed state to database insert format
 */
export function toDbInsert(state: ComputedTransformationState): NewTransformationState {
  return {
    placeId: state.placeId,
    intensity: state.intensity,
    nature: state.nature,
    certainty: state.certainty,
    headline: state.headline,
    oneLiner: state.oneLiner,
    disruptionSummary: state.disruptionSummary,
    disruptionStart: state.disruptionStart?.toISOString().split('T')[0] ?? null,
    disruptionEnd: state.disruptionEnd?.toISOString().split('T')[0] ?? null,
    visibleChangeDate: state.visibleChangeDate?.toISOString().split('T')[0] ?? null,
    usageChangeDate: state.usageChangeDate?.toISOString().split('T')[0] ?? null,
    isEstimatedStart: state.isEstimatedStart ? 1 : 0,
    isEstimatedEnd: state.isEstimatedEnd ? 1 : 0,
    approvalDate: state.approvalDate?.toISOString().split('T')[0] ?? null,
    permitExpiration: state.permitExpiration?.toISOString().split('T')[0] ?? null,
    projectStatus: state.projectStatus,
    eventCount: state.eventCount,
    firstActivity: state.firstActivity?.toISOString().split('T')[0] ?? null,
    lastActivity: state.lastActivity?.toISOString().split('T')[0] ?? null,
  };
}

/**
 * Batch compute transformation states for multiple places
 */
export function computeTransformationStates(
  inputs: TransformationInput[]
): ComputedTransformationState[] {
  return inputs.map(computeTransformationState);
}
