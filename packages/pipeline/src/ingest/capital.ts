/**
 * Capital Projects data ingestion
 * Source: NYC Open Data - Capital Projects Database (CPDB)
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';
import type { EventType, TransformationNature } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface CapitalProject {
  maprojid: string;
  projectid?: string;
  magencyname: string;
  magencyacro?: string;
  description: string;
  typecategory?: string;
  mindate?: string;
  maxdate?: string;
  plannedcommit_total?: string;
  adopt_total?: string;
  allocate_total?: string;
  commit_total?: string;
  spent_total?: string;
  the_geom?: {
    type: string;
    coordinates: number[][];
  };
}

export interface NormalizedCapitalEvent {
  source: 'capital';
  sourceId: string;
  eventType: EventType;
  eventDate: Date;
  projectDescription: string;
  managingAgency: string;
  agencyAcronym: string | null;
  projectType: string | null;
  latitude: number | null;
  longitude: number | null;
  totalCost: number | null;
  nature: TransformationNature;
  rawData: CapitalProject;
}

// =============================================================================
// CATEGORY MAPPING
// =============================================================================

/**
 * Map project category to transformation nature
 * Most capital projects are infrastructure
 */
export function mapProjectCategory(typeCategory?: string): TransformationNature {
  // Almost all capital projects are infrastructure
  // Could refine based on agency or type if needed
  return 'infrastructure';
}

// =============================================================================
// NORMALIZATION
// =============================================================================

/**
 * Normalize a capital project to our event format
 */
export function normalizeCapitalProject(
  project: CapitalProject
): NormalizedCapitalEvent | null {
  // Require at minimum maprojid
  if (!project.maprojid) {
    return null;
  }

  // Parse date - use mindate or fallback to current date
  let eventDate: Date;
  if (project.mindate) {
    eventDate = new Date(project.mindate);
    if (isNaN(eventDate.getTime())) {
      eventDate = new Date();
    }
  } else {
    eventDate = new Date();
  }

  // Parse coordinates from the_geom (GeoJSON MultiPoint)
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (project.the_geom && project.the_geom.coordinates && project.the_geom.coordinates.length > 0) {
    const firstPoint = project.the_geom.coordinates[0];
    if (firstPoint && firstPoint.length >= 2) {
      longitude = firstPoint[0] ?? null;
      latitude = firstPoint[1] ?? null;
    }
  }

  // Parse cost - use plannedcommit_total or adopt_total
  const costStr = project.plannedcommit_total || project.adopt_total || project.allocate_total;
  const totalCost = costStr ? parseFloat(costStr) : null;

  return {
    source: 'capital',
    sourceId: project.maprojid,
    eventType: 'capital_project',
    eventDate,
    projectDescription: project.description,
    managingAgency: project.magencyname,
    agencyAcronym: project.magencyacro ?? null,
    projectType: project.typecategory ?? null,
    latitude: latitude && !isNaN(latitude) ? latitude : null,
    longitude: longitude && !isNaN(longitude) ? longitude : null,
    totalCost: totalCost && !isNaN(totalCost) ? totalCost : null,
    nature: mapProjectCategory(project.typecategory),
    rawData: project,
  };
}

// =============================================================================
// API FETCHING
// =============================================================================

/**
 * Fetch capital projects from NYC Open Data
 */
export async function fetchCapitalProjects(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<CapitalProject[]> {
  const { sinceDate, limit = 10000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: 'mindate DESC',
  });

  // Filter by date if provided
  if (sinceDate) {
    const dateStr = sinceDate.toISOString().split('T')[0];
    params.set('$where', `mindate >= '${dateStr}'`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.capitalProjects}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`Capital Projects API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<CapitalProject[]>;
  } catch (error) {
    console.error('Failed to fetch capital projects:', error);
    return [];
  }
}

/**
 * Batch fetch all capital projects since a date
 */
export async function fetchAllCapitalProjectsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedCapitalEvent[]> {
  const { appToken, onProgress } = options;
  const batchSize = 10000;
  const allEvents: NormalizedCapitalEvent[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const projects = await fetchCapitalProjects({
      sinceDate,
      limit: batchSize,
      offset,
      appToken,
    });

    // Normalize and filter valid projects
    for (const project of projects) {
      const normalized = normalizeCapitalProject(project);
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allEvents;
}
