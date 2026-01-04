/**
 * ZAP (Zoning Application Portal) data ingestion
 * Source: NYC Open Data - ZAP Project Data
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';
import type { EventType } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface ZAPProject {
  project_id: string;
  project_name: string;
  project_brief?: string;
  project_status?: string;
  public_status: string;
  ulurp_non?: string;
  actions?: string;
  ulurp_numbers?: string;
  ceqr_number?: string;
  primary_applicant?: string;
  applicant_type?: string;
  borough?: string;
  community_district?: string;
  flood_zone_a?: string;
  flood_zone_shadedx?: string;
  current_milestone?: string;
  current_milestone_date?: string;
  app_filed_date?: string;
  certified_referred?: string;
  completed_date?: string;
}

export interface NormalizedZAPEvent {
  source: 'zap';
  sourceId: string;
  eventType: EventType;
  eventDate: Date;
  projectName: string;
  projectBrief: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  communityDistrict: string | null;
  isULURP: boolean;
  actions: string | null;
  rawData: ZAPProject;
}

// =============================================================================
// STATUS MAPPING
// =============================================================================

const TRACKED_STATUSES = ['Filed', 'Complete', 'Completed', 'Approved', 'Active', 'Denied'] as const;
type TrackedStatus = typeof TRACKED_STATUSES[number];

/**
 * Map ZAP action type and status to our event type
 */
export function mapZAPActionToEventType(
  ulurpType: string | undefined,
  publicStatus: string
): EventType | null {
  const isULURP = ulurpType === 'ULURP';

  // Normalize status
  const status = publicStatus.toLowerCase();

  if (isULURP) {
    if (status.includes('filed') || status.includes('active')) {
      return 'ulurp_filed';
    }
    if (status.includes('complete') || status.includes('approved')) {
      return 'ulurp_approved';
    }
    if (status.includes('denied') || status.includes('withdrawn')) {
      return 'ulurp_denied';
    }
    return null;
  } else {
    // Non-ULURP actions
    if (status.includes('filed') || status.includes('active')) {
      return 'zap_filed';
    }
    if (status.includes('complete') || status.includes('approved')) {
      return 'zap_approved';
    }
    return null;
  }
}

/**
 * Map borough name to standard form
 */
function mapBorough(borough?: string): string | null {
  if (!borough) return null;

  const mapping: Record<string, string> = {
    'MN': 'Manhattan',
    'BX': 'Bronx',
    'BK': 'Brooklyn',
    'QN': 'Queens',
    'SI': 'Staten Island',
    'Manhattan': 'Manhattan',
    'Bronx': 'Bronx',
    'Brooklyn': 'Brooklyn',
    'Queens': 'Queens',
    'Staten Island': 'Staten Island',
  };

  return mapping[borough] ?? borough;
}

// =============================================================================
// NORMALIZATION
// =============================================================================

/**
 * Normalize a ZAP project to our event format
 */
export function normalizeZAPProject(project: ZAPProject): NormalizedZAPEvent | null {
  const isULURP = project.ulurp_non === 'ULURP';

  // Determine event type from status
  const eventType = mapZAPActionToEventType(project.ulurp_non, project.public_status);
  if (!eventType) {
    return null; // Status not tracked
  }

  // Parse date - use certified_referred, app_filed_date, or fallback to current date
  let eventDate: Date;
  const dateStr = project.certified_referred || project.app_filed_date;
  if (dateStr) {
    eventDate = new Date(dateStr);
    if (isNaN(eventDate.getTime())) {
      eventDate = new Date();
    }
  } else {
    eventDate = new Date();
  }

  return {
    source: 'zap',
    sourceId: project.project_id,
    eventType,
    eventDate,
    projectName: project.project_name,
    projectBrief: project.project_brief ?? null,
    borough: mapBorough(project.borough),
    latitude: null, // NYC Open Data ZAP doesn't include coordinates
    longitude: null,
    communityDistrict: project.community_district ?? null,
    isULURP,
    actions: project.actions ?? null,
    rawData: project,
  };
}

// =============================================================================
// API FETCHING
// =============================================================================

/**
 * Fetch ZAP projects from NYC Open Data
 */
export async function fetchZAPProjects(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<ZAPProject[]> {
  const { sinceDate, limit = 1000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: 'certified_referred DESC NULLS LAST',
  });

  // Filter by date if provided
  if (sinceDate) {
    const dateStr = sinceDate.toISOString().split('T')[0];
    params.set('$where', `certified_referred >= '${dateStr}' OR app_filed_date >= '${dateStr}'`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.zapProjects}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`ZAP API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<ZAPProject[]>;
  } catch (error) {
    console.error('Failed to fetch ZAP projects:', error);
    return [];
  }
}

/**
 * Batch fetch all ZAP projects since a date
 */
export async function fetchAllZAPProjectsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedZAPEvent[]> {
  const { appToken, onProgress } = options;
  const batchSize = 1000;
  const allEvents: NormalizedZAPEvent[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const projects = await fetchZAPProjects({
      sinceDate,
      limit: batchSize,
      offset,
      appToken,
    });

    // Normalize and filter valid projects
    for (const project of projects) {
      const normalized = normalizeZAPProject(project);
      if (normalized) {
        allEvents.push(normalized);
      }
    }

    onProgress?.(allEvents.length);

    // Check if there are more results
    if (projects.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return allEvents;
}
