/**
 * CEQR (City Environmental Quality Review) data ingestion
 * Source: NYC Open Data - CEQR Projects
 *
 * CEQR reviews are required for projects that may affect the environment.
 * Strong signal for major future development (2-10 year horizon).
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';
import type { EventType } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface CEQRProject {
  // Primary identifier - can be 'ceqr' or 'ceqrnumber' depending on API version
  ceqr?: string;
  ceqrnumber?: string;
  // Project info - can be snake_case or camelCase
  project_name?: string;
  projectname?: string;
  project_description?: string;
  projectdescription?: string;
  lead_agency?: string;
  leadagencyname?: string;
  leadagencyacronym?: string;
  ceqrtype?: string;           // Type I, Type II, Unlisted
  reviewtype?: string;         // EAS, EIS, etc.
  projectstatus?: string;
  projectcompleted?: string;
  eassubmitteddate?: string;
  deissubmitteddate?: string;
  feissubmitteddate?: string;
  noaccepteddate?: string;
  borough?: string;
  communitydistrict?: string;
  zipcode?: string;
  url?: string;
}

export interface CEQRMilestone {
  ceqrnumber: string;
  milestonename?: string;
  milestonedate?: string;
  milestonestatus?: string;
}

export interface NormalizedCEQREvent {
  source: 'ceqr';
  sourceId: string;
  eventType: EventType;
  eventDate: Date;
  projectName: string;
  projectDescription: string | null;
  leadAgency: string | null;
  ceqrType: string | null;
  reviewType: string | null;
  borough: string | null;
  communityDistrict: string | null;
  latitude: number | null;  // CEQR dataset doesn't have coordinates
  longitude: number | null;
  rawData: CEQRProject;
}

// =============================================================================
// EVENT TYPE MAPPING
// =============================================================================

/**
 * Map CEQR review status to event type
 */
export function mapCEQRToEventType(project: CEQRProject): EventType | null {
  const status = project.projectstatus?.toLowerCase() || '';
  const reviewType = project.reviewtype?.toLowerCase() || '';

  // If project is completed
  if (status.includes('complete') || project.projectcompleted) {
    return 'ceqr_completed';
  }

  // If FEIS submitted
  if (project.feissubmitteddate) {
    return 'ceqr_eis_final';
  }

  // If DEIS submitted
  if (project.deissubmitteddate) {
    return 'ceqr_eis_draft';
  }

  // If EAS submitted or project is active
  if (project.eassubmitteddate || status.includes('active') || status.includes('in progress')) {
    return 'ceqr_eas';
  }

  // Check review type
  if (reviewType.includes('eis') || reviewType.includes('environmental impact')) {
    return 'ceqr_eis_draft';
  }

  if (reviewType.includes('eas') || reviewType.includes('environmental assessment')) {
    return 'ceqr_eas';
  }

  // Default to EAS for any active CEQR
  if (status) {
    return 'ceqr_eas';
  }

  return null;
}

/**
 * Get the most relevant date from a CEQR project
 */
function getCEQRDate(project: CEQRProject): Date | null {
  // Try dates in order of significance
  const dateStr = project.feissubmitteddate
    || project.deissubmitteddate
    || project.eassubmitteddate
    || project.noaccepteddate;

  if (!dateStr) {
    return null;
  }

  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// =============================================================================
// NORMALIZATION
// =============================================================================

/**
 * Map borough name to standardized format
 */
function mapBorough(borough: string | undefined): string | null {
  if (!borough) return null;

  const mapping: Record<string, string> = {
    'MANHATTAN': 'Manhattan',
    'MN': 'Manhattan',
    'BRONX': 'Bronx',
    'BX': 'Bronx',
    'BROOKLYN': 'Brooklyn',
    'BK': 'Brooklyn',
    'QUEENS': 'Queens',
    'QN': 'Queens',
    'STATEN ISLAND': 'Staten Island',
    'SI': 'Staten Island',
  };

  return mapping[borough.toUpperCase()] || borough;
}

/**
 * Normalize a CEQR project to our event format
 * Handles both snake_case and camelCase field names from API
 */
export function normalizeCEQRProject(project: CEQRProject): NormalizedCEQREvent | null {
  // Handle both field name variants
  const ceqrNumber = project.ceqrnumber || project.ceqr;
  const projectName = project.projectname || project.project_name;

  if (!ceqrNumber || !projectName) {
    return null;
  }

  const eventType = mapCEQRToEventType(project);
  if (!eventType) {
    // Default to EAS for projects without specific status
    // return null;
  }

  const eventDate = getCEQRDate(project);
  if (!eventDate) {
    // Use current date as fallback for active projects
    if (!project.projectstatus && !project.borough) {
      return null;
    }
  }

  return {
    source: 'ceqr',
    sourceId: ceqrNumber,
    eventType: eventType || 'ceqr_eas',
    eventDate: eventDate || new Date(),
    projectName,
    projectDescription: project.projectdescription || project.project_description || null,
    leadAgency: project.leadagencyname || project.lead_agency || null,
    ceqrType: project.ceqrtype || null,
    reviewType: project.reviewtype || null,
    borough: mapBorough(project.borough),
    communityDistrict: project.communitydistrict || null,
    latitude: null,  // CEQR data doesn't include coordinates
    longitude: null,
    rawData: project,
  };
}

// =============================================================================
// API FETCHING
// =============================================================================

/**
 * Fetch CEQR projects from NYC Open Data
 */
export async function fetchCEQRProjects(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<CEQRProject[]> {
  const { limit = 10000, offset = 0, appToken } = options;

  // Note: CEQR dataset doesn't have date fields, so we fetch all projects
  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.ceqrProjects}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`CEQR API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<CEQRProject[]>;
  } catch (error) {
    console.error('Failed to fetch CEQR projects:', error);
    return [];
  }
}

/**
 * Batch fetch all CEQR projects since a date
 */
export async function fetchAllCEQRProjectsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedCEQREvent[]> {
  const { appToken, onProgress } = options;
  const batchSize = 10000;
  const allEvents: NormalizedCEQREvent[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const projects = await fetchCEQRProjects({
      sinceDate,
      limit: batchSize,
      offset,
      appToken,
    });

    for (const project of projects) {
      const normalized = normalizeCEQRProject(project);
      if (normalized) {
        allEvents.push(normalized);
      }
    }

    onProgress?.(allEvents.length);

    if (projects.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allEvents;
}
