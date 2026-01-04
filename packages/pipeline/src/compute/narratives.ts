/**
 * Narrative generation
 * Creates human-readable summaries for transformation states
 * From SPEC_REFINED: Users want to understand quickly, no acronyms
 */

import type { Certainty, TransformationNature } from '@ucm/shared';
import { formatCount } from '@ucm/shared';
import type { RawEvent } from '../db/schema.js';
import type { ImpactPhases } from './phases.js';

export interface Narratives {
  headline: string;
  oneLiner: string;
  disruptionSummary: string | null;
}

export interface NarrativeContext {
  events: RawEvent[];
  nature: TransformationNature;
  certainty: Certainty;
  phases: ImpactPhases;
}

/**
 * Generate human-readable narratives for a transformation
 */
export function generateNarratives(context: NarrativeContext): Narratives {
  const { events, nature, certainty, phases } = context;

  // Count significant event types
  const counts = countEventTypes(events);

  // Generate headline
  const headline = generateHeadline(counts, certainty);

  // Generate one-liner
  const oneLiner = generateOneLiner(counts);

  // Generate disruption summary
  const disruptionSummary = generateDisruptionSummary(phases);

  return { headline, oneLiner, disruptionSummary };
}

interface EventCounts {
  newBuildings: number;
  demolitions: number;
  majorWorks: number;
  minorWorks: number;
  capitalProjects: number;
}

function countEventTypes(events: RawEvent[]): EventCounts {
  const counts: EventCounts = {
    newBuildings: 0,
    demolitions: 0,
    majorWorks: 0,
    minorWorks: 0,
    capitalProjects: 0,
  };

  for (const event of events) {
    switch (event.eventType) {
      case 'new_building':
        counts.newBuildings++;
        break;
      case 'demolition':
        counts.demolitions++;
        break;
      case 'major_alteration':
        counts.majorWorks++;
        break;
      case 'minor_alteration':
        counts.minorWorks++;
        break;
      case 'capital_project':
        counts.capitalProjects++;
        break;
    }
  }

  return counts;
}

/**
 * Generate the main headline (5-10 words)
 */
function generateHeadline(counts: EventCounts, certainty: Certainty): string {
  let headline: string;

  // Prioritize by significance
  if (counts.newBuildings > 0) {
    if (counts.newBuildings === 1) {
      headline = 'Nouvel immeuble en préparation';
    } else {
      headline = `${counts.newBuildings} nouveaux immeubles en préparation`;
    }
  } else if (counts.demolitions > 0) {
    if (counts.demolitions === 1) {
      headline = 'Démolition en cours';
    } else {
      headline = 'Démolition et reconstruction';
    }
  } else if (counts.majorWorks > 0) {
    headline = 'Rénovation majeure en cours';
  } else if (counts.capitalProjects > 0) {
    headline = 'Projet public en développement';
  } else if (counts.minorWorks > 0) {
    headline = 'Travaux de rénovation';
  } else {
    headline = 'Activité de transformation';
  }

  // Adjust for certainty level
  if (certainty === 'discussion') {
    headline = headline
      .replace('en préparation', 'à l\'étude')
      .replace('en cours', 'envisagée')
      .replace('en développement', 'à l\'étude');
  }

  return headline;
}

/**
 * Generate the one-liner summary (factual count)
 */
function generateOneLiner(counts: EventCounts): string {
  const parts: string[] = [];

  if (counts.newBuildings > 0) {
    parts.push(formatCount(counts.newBuildings, 'immeuble'));
  }
  if (counts.demolitions > 0) {
    parts.push(formatCount(counts.demolitions, 'démolition'));
  }
  if (counts.majorWorks > 0) {
    parts.push(formatCount(counts.majorWorks, 'rénovation majeure'));
  }
  if (counts.capitalProjects > 0) {
    parts.push(formatCount(counts.capitalProjects, 'projet public'));
  }

  if (parts.length === 0) {
    if (counts.minorWorks > 0) {
      return formatCount(counts.minorWorks, 'rénovation mineure');
    }
    return 'Activité de transformation';
  }

  return parts.join(' + ');
}

/**
 * Generate the disruption summary
 */
function generateDisruptionSummary(phases: ImpactPhases): string | null {
  if (!phases.disruptionStart || !phases.disruptionEnd) {
    return null;
  }

  const startYear = phases.disruptionStart.getFullYear();
  const endYear = phases.disruptionEnd.getFullYear();
  const now = new Date();

  // If already completed
  if (phases.disruptionEnd < now) {
    return `Travaux terminés en ${endYear}`;
  }

  // If in progress
  if (phases.disruptionStart <= now && phases.disruptionEnd > now) {
    if (startYear === endYear) {
      return `Travaux en cours jusqu'à fin ${endYear}`;
    }
    return `Travaux en cours jusqu'en ${endYear}`;
  }

  // If in the future
  if (startYear === endYear) {
    return `Perturbations prévues en ${startYear}`;
  }

  return `Perturbations prévues de ${startYear} à ${endYear}`;
}

/**
 * Generate a complete narrative for display
 */
export function generateFullNarrative(context: NarrativeContext): string {
  const { headline, oneLiner, disruptionSummary } = generateNarratives(context);

  let narrative = headline;

  if (oneLiner && oneLiner !== headline) {
    narrative += `. ${oneLiner}`;
  }

  if (disruptionSummary) {
    narrative += `. ${disruptionSummary}`;
  }

  return narrative + '.';
}
