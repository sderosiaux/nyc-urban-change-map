/**
 * Impact phases computation
 * Extracts REAL dates from source data with clear estimation tracking.
 *
 * PRINCIPLE: Only use dates that exist in source data. Mark any derived dates as estimated.
 *
 * Source-specific date mapping:
 * - Capital Projects: mindate (start), maxdate (end) → REAL
 * - DOB Permits: job_start_date → REAL start; NO completion date
 * - DOB NOW: first_permit_date → indicates permit, NOT construction start
 * - CEQR: Environmental review dates only, NO construction dates
 * - ZAP: completed_date is approval, NOT construction completion
 * - DOB Complaints/Violations: Issue dates, NOT construction
 */

import type { RawEvent } from '../db/schema.js';

export interface ImpactPhases {
  disruptionStart: Date | null;
  disruptionEnd: Date | null;
  visibleChangeDate: Date | null;
  usageChangeDate: Date | null;
  isEstimatedStart: boolean;
  isEstimatedEnd: boolean;
  // Additional milestone dates
  approvalDate: Date | null;      // ZAP completed_date
  permitExpiration: Date | null;  // DOB expiration_date
  // Derived status
  projectStatus: ProjectStatus;
}

export type ProjectStatus = 'planning' | 'approved' | 'active' | 'stalled' | 'completed';

interface ExtractedDate {
  date: Date;
  isEstimated: boolean;
  source: string;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Extract impact phases from events using source-specific logic.
 * Returns real dates where available, with estimation flags.
 */
export function estimateImpactPhases(events: RawEvent[]): ImpactPhases {
  const phases: ImpactPhases = {
    disruptionStart: null,
    disruptionEnd: null,
    visibleChangeDate: null,
    usageChangeDate: null,
    isEstimatedStart: false,
    isEstimatedEnd: false,
    approvalDate: null,
    permitExpiration: null,
    projectStatus: 'planning',
  };

  if (events.length === 0) return phases;

  // Try to find REAL dates from each source type
  const startDate = findBestStartDate(events);
  const endDate = findBestEndDate(events);

  if (startDate) {
    phases.disruptionStart = startDate.date;
    phases.isEstimatedStart = startDate.isEstimated;
  }

  if (endDate) {
    phases.disruptionEnd = endDate.date;
    phases.visibleChangeDate = endDate.date;
    phases.isEstimatedEnd = endDate.isEstimated;
  }

  // Extract additional milestone dates
  phases.approvalDate = findApprovalDate(events);
  phases.permitExpiration = findPermitExpiration(events);

  // Derive project status
  phases.projectStatus = deriveProjectStatus(phases, events);

  return phases;
}

// =============================================================================
// START DATE EXTRACTION
// =============================================================================

/**
 * Find the best available start date across all events.
 * Priority: actual construction events > source-specific real dates > permit dates (estimated)
 */
function findBestStartDate(events: RawEvent[]): ExtractedDate | null {
  // 1. Look for actual construction_started event (highest confidence)
  const constructionStarted = findEventByType(events, 'construction_started');
  if (constructionStarted) {
    return {
      date: new Date(constructionStarted.eventDate),
      isEstimated: false,
      source: 'construction_started event',
    };
  }

  // 2. Check source-specific real dates
  for (const event of events) {
    const rawData = event.rawData as Record<string, unknown> | null;
    if (!rawData) continue;

    const source = event.source;

    // Capital Projects: mindate is REAL project start
    if (source === 'capital' && rawData['mindate']) {
      const date = parseDate(rawData['mindate']);
      if (date) {
        return { date, isEstimated: false, source: 'capital:mindate' };
      }
    }

    // DOB Permits: job_start_date is REAL construction start
    if (source === 'dob' && rawData['job_start_date']) {
      const date = parseDate(rawData['job_start_date']);
      if (date) {
        return { date, isEstimated: false, source: 'dob:job_start_date' };
      }
    }
  }

  // 3. Fallback: Use permit issuance as estimated start
  // This is an ESTIMATE because permit ≠ construction start
  for (const event of events) {
    const rawData = event.rawData as Record<string, unknown> | null;
    if (!rawData) continue;

    // DOB permits: issuance_date indicates permit granted
    if (event.source === 'dob' && rawData['issuance_date']) {
      const date = parseDate(rawData['issuance_date']);
      if (date) {
        return { date, isEstimated: true, source: 'dob:issuance_date (estimated)' };
      }
    }

    // DOB NOW: first_permit_date
    if (event.source === 'dob-now' && rawData['first_permit_date']) {
      const date = parseDate(rawData['first_permit_date']);
      if (date) {
        return { date, isEstimated: true, source: 'dob-now:first_permit_date (estimated)' };
      }
    }
  }

  // 4. Last resort: Use event date of permit-type events as estimated start
  const permitEvents = events.filter(e =>
    ['new_building', 'major_alteration', 'demolition'].includes(e.eventType)
  ).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  if (permitEvents.length > 0) {
    return {
      date: new Date(permitEvents[0]!.eventDate),
      isEstimated: true,
      source: `${permitEvents[0]!.eventType} event date (estimated)`,
    };
  }

  return null;
}

// =============================================================================
// END DATE EXTRACTION
// =============================================================================

/**
 * Find the best available end date across all events.
 * Priority: actual completion events > source-specific real dates
 * NOTE: We do NOT estimate end dates - if no real data, return null
 */
function findBestEndDate(events: RawEvent[]): ExtractedDate | null {
  // 1. Look for actual construction_completed event (highest confidence)
  const constructionCompleted = findEventByType(events, 'construction_completed');
  if (constructionCompleted) {
    return {
      date: new Date(constructionCompleted.eventDate),
      isEstimated: false,
      source: 'construction_completed event',
    };
  }

  // 2. Check source-specific real dates
  for (const event of events) {
    const rawData = event.rawData as Record<string, unknown> | null;
    if (!rawData) continue;

    const source = event.source;

    // Capital Projects: maxdate is REAL project end
    if (source === 'capital' && rawData['maxdate']) {
      const date = parseDate(rawData['maxdate']);
      if (date) {
        return { date, isEstimated: false, source: 'capital:maxdate' };
      }
    }

    // DOB permits: Look for actual completion-related fields
    if (source === 'dob') {
      // Check for fields that indicate actual completion
      const completionField = rawData['fully_permitted_date'] ||
                             rawData['certificate_of_occupancy_date'] ||
                             rawData['signoff_date'];
      if (completionField) {
        const date = parseDate(completionField);
        if (date) {
          return { date, isEstimated: false, source: 'dob:completion_field' };
        }
      }
    }
  }

  // 3. NO ESTIMATION for end dates
  // If we don't have real data, we don't make one up
  // This is a key principle: no fake future dates

  return null;
}

// =============================================================================
// UTILITIES
// =============================================================================

function findEventByType(events: RawEvent[], eventType: string): RawEvent | null {
  return events.find(e => e.eventType === eventType) ?? null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value !== 'string') return null;

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// =============================================================================
// PHASE UTILITIES
// =============================================================================

/**
 * Check if a date falls within the disruption period
 */
export function isInDisruptionPeriod(date: Date, phases: ImpactPhases): boolean {
  if (!phases.disruptionStart || !phases.disruptionEnd) return false;
  return date >= phases.disruptionStart && date <= phases.disruptionEnd;
}

/**
 * Get the phase label for a given date
 */
export function getPhaseAtDate(date: Date, phases: ImpactPhases): string {
  if (!phases.disruptionStart) return 'Inconnu';

  if (date < phases.disruptionStart) {
    return 'Avant travaux';
  }

  if (phases.disruptionEnd && date <= phases.disruptionEnd) {
    return 'En travaux';
  }

  return 'Achevé';
}

// =============================================================================
// ADDITIONAL DATE EXTRACTION
// =============================================================================

/**
 * Find ZAP approval date (completed_date)
 */
function findApprovalDate(events: RawEvent[]): Date | null {
  for (const event of events) {
    if (event.source !== 'zap') continue;

    const rawData = event.rawData as Record<string, unknown> | null;
    if (!rawData) continue;

    // ZAP completed_date = when the zoning application was approved
    const completedDate = rawData['completed_date'];
    if (completedDate) {
      const date = parseDate(completedDate);
      if (date) return date;
    }
  }
  return null;
}

/**
 * Find DOB permit expiration date
 */
function findPermitExpiration(events: RawEvent[]): Date | null {
  // Find the latest permit expiration across all DOB events
  let latestExpiration: Date | null = null;

  for (const event of events) {
    if (event.source !== 'dob' && event.source !== 'dob-now') continue;

    const rawData = event.rawData as Record<string, unknown> | null;
    if (!rawData) continue;

    const expirationDate = rawData['expiration_date'];
    if (expirationDate) {
      const date = parseDate(expirationDate);
      if (date && (!latestExpiration || date > latestExpiration)) {
        latestExpiration = date;
      }
    }
  }
  return latestExpiration;
}

// =============================================================================
// PROJECT STATUS DERIVATION
// =============================================================================

/**
 * Derive project status from available dates and events
 *
 * Status logic:
 * - 'completed': Has disruptionEnd in the past
 * - 'active': Has disruptionStart in the past, no end yet
 * - 'stalled': Permit expired without completion
 * - 'approved': Has approval date but no construction start
 * - 'planning': Default - early stage
 */
function deriveProjectStatus(phases: ImpactPhases, events: RawEvent[]): ProjectStatus {
  const now = new Date();

  // Check for completion first
  if (phases.disruptionEnd && phases.disruptionEnd <= now) {
    return 'completed';
  }

  // Check for stalled: permit expired without completion
  if (phases.permitExpiration && phases.permitExpiration < now) {
    // Permit has expired
    if (!phases.disruptionEnd) {
      // No completion date = likely stalled
      return 'stalled';
    }
  }

  // Check for active construction
  if (phases.disruptionStart && phases.disruptionStart <= now) {
    // Construction has started (or should have by now)
    if (!phases.disruptionEnd || phases.disruptionEnd > now) {
      return 'active';
    }
  }

  // Check for approved but not started
  if (phases.approvalDate) {
    return 'approved';
  }

  // Check for any permit activity (indicates more than just planning)
  const hasPermit = events.some(e =>
    ['new_building', 'major_alteration', 'demolition'].includes(e.eventType)
  );
  if (hasPermit) {
    return 'approved'; // Has permit = approved
  }

  return 'planning';
}
