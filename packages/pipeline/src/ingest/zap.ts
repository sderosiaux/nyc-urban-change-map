/**
 * ZAP (Zoning Application Portal) data ingestion
 * Source: NYC Open Data - ZAP Project Data
 *
 * ZAP projects don't have coordinates directly, but we can get them via:
 * 1. ZAP BBL dataset (project_id -> bbl mapping)
 * 2. PLUTO (bbl -> latitude/longitude)
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';
import type { EventType } from '@ucm/shared';
import { fetchPLUTOByBBL } from './pluto.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ZAPBblRecord {
  project_id: string;
  bbl: string;
  validated_borough?: string;
  validated_block?: string;
  validated_lot?: string;
  validated?: string;
  validated_date?: string;
  unverified_borough?: string;
  unverified_block?: string;
  unverified_lot?: string;
}

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
 * Track ALL statuses - we'll decide what to show later
 */
export function mapZAPActionToEventType(
  ulurpType: string | undefined,
  publicStatus: string
): EventType {
  const isULURP = ulurpType === 'ULURP';

  // Normalize status
  const status = publicStatus.toLowerCase();

  if (isULURP) {
    if (status.includes('complete') || status.includes('approved')) {
      return 'ulurp_approved';
    }
    if (status.includes('denied') || status.includes('withdrawn')) {
      return 'ulurp_denied';
    }
    // All other statuses (filed, active, noticed, etc.) = filed
    return 'ulurp_filed';
  } else {
    // Non-ULURP actions
    if (status.includes('complete') || status.includes('approved')) {
      return 'zap_approved';
    }
    // All other statuses = filed
    return 'zap_filed';
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
 * Fetch BBLs for a ZAP project from the ZAP BBL dataset
 */
export async function fetchZAPBbls(options: {
  projectId?: string;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<ZAPBblRecord[]> {
  const { projectId, limit = 1000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
  });

  if (projectId) {
    params.set('$where', `project_id = '${projectId}'`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.zapBbl}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`ZAP BBL API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<ZAPBblRecord[]>;
  } catch (error) {
    console.error('Failed to fetch ZAP BBLs:', error);
    return [];
  }
}

/**
 * Get coordinates for a ZAP project by fetching its BBLs and looking up PLUTO
 * Returns the first valid coordinate found (a project can span multiple BBLs)
 */
export async function getZAPProjectCoordinates(
  projectId: string,
  options: { appToken?: string } = {}
): Promise<{ latitude: number; longitude: number; bbl: string } | null> {
  const { appToken } = options;

  // Fetch BBLs for this project
  const bbls = await fetchZAPBbls({ projectId, appToken });

  if (bbls.length === 0) {
    return null;
  }

  // Try each BBL until we find one with coordinates in PLUTO
  for (const bblRecord of bbls) {
    if (!bblRecord.bbl) continue;

    const pluto = await fetchPLUTOByBBL(bblRecord.bbl, { appToken });

    if (pluto?.latitude && pluto?.longitude) {
      return {
        latitude: pluto.latitude,
        longitude: pluto.longitude,
        bbl: bblRecord.bbl,
      };
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return null;
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

/**
 * Enrich ZAP events with coordinates by looking up BBLs and PLUTO
 * This is slow (makes API calls per project) so use with caution
 */
export async function enrichZAPEventsWithCoordinates(
  events: NormalizedZAPEvent[],
  options: {
    appToken?: string;
    onProgress?: (current: number, total: number) => void;
    concurrency?: number;
  } = {}
): Promise<NormalizedZAPEvent[]> {
  const { appToken, onProgress, concurrency = 5 } = options;
  const enriched: NormalizedZAPEvent[] = [];

  // Process in batches to manage concurrency
  for (let i = 0; i < events.length; i += concurrency) {
    const batch = events.slice(i, i + concurrency);

    const enrichedBatch = await Promise.all(
      batch.map(async (event) => {
        // Skip if already has coordinates
        if (event.latitude && event.longitude) {
          return event;
        }

        const coords = await getZAPProjectCoordinates(event.sourceId, { appToken });

        if (coords) {
          return {
            ...event,
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }

        return event;
      })
    );

    enriched.push(...enrichedBatch);
    onProgress?.(enriched.length, events.length);

    // Small delay between batches
    if (i + concurrency < events.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return enriched;
}

/**
 * Fetch and enrich all ZAP projects with coordinates
 * Combined function for convenience
 */
export async function fetchAllZAPProjectsWithCoordinates(
  sinceDate: Date,
  options: {
    appToken?: string;
    onProgress?: (message: string) => void;
  } = {}
): Promise<NormalizedZAPEvent[]> {
  const { appToken, onProgress } = options;

  // Step 1: Fetch all projects
  onProgress?.('Fetching ZAP projects...');
  const events = await fetchAllZAPProjectsSince(sinceDate, {
    appToken,
    onProgress: (count) => onProgress?.(`Fetched ${count} ZAP projects...`),
  });

  if (events.length === 0) {
    return [];
  }

  // Step 2: Enrich with coordinates
  onProgress?.(`Enriching ${events.length} projects with coordinates...`);
  const enriched = await enrichZAPEventsWithCoordinates(events, {
    appToken,
    onProgress: (current, total) =>
      onProgress?.(`Enriched ${current}/${total} projects with coordinates...`),
  });

  // Count how many got coordinates
  const withCoords = enriched.filter(e => e.latitude && e.longitude).length;
  onProgress?.(`Done! ${withCoords}/${events.length} projects have coordinates.`);

  return enriched;
}
