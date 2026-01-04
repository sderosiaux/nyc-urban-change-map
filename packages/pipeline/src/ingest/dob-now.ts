/**
 * DOB NOW data ingestion
 * Source: NYC Open Data - DOB NOW: Build – Job Application Filings
 *
 * DOB NOW contains active permits and current job statuses.
 * More real-time than DOB Permit Issuance (historical).
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';
import type { EventType } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface DOBNowJob {
  job_filing_number: string;
  filing_status?: string;
  borough: string;
  bin?: string;
  house_no?: string;
  street_name?: string;
  block?: string;
  lot?: string;
  bbl?: string;
  commmunity_board?: string;
  work_on_floor?: string;
  // Work type flags (1 = yes, 0 = no)
  general_construction_work_type_?: string;
  plumbing_work_type?: string;
  sprinkler_work_type?: string;
  boiler_equipment_work_type_?: string;
  earth_work_work_type_?: string;
  scaffold?: string;
  shed?: string;
  fence?: string;
  sign?: string;
  curb_cut?: string;
  // Date fields
  filing_date?: string;
  current_status_date?: string;
  first_permit_date?: string;
  // Owner info
  owner_s_business_name?: string;
  // Location
  postcode?: string;
  latitude?: string;
  longitude?: string;
  nta?: string;
  census_tract?: string;
  council_district?: string;
  initial_cost?: string;
  building_type?: string;
}

export interface NormalizedDOBNowEvent {
  source: 'dob-now';
  sourceId: string;
  eventType: EventType;
  eventDate: Date;
  bin: string | null;
  address: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  ntaCode: string | null;
  communityDistrict: string | null;
  jobStatus: string | null;
  rawData: DOBNowJob;
}

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Fetch DOB NOW jobs from NYC Open Data
 */
export async function fetchDOBNowJobs(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<DOBNowJob[]> {
  const { sinceDate, limit = 10000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: 'current_status_date DESC',
  });

  if (sinceDate) {
    const dateStr = sinceDate.toISOString().split('T')[0];
    params.set('$where', `current_status_date >= '${dateStr}' AND current_status_date IS NOT NULL`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.dobNow}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`DOB NOW API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<DOBNowJob[]>;
  } catch (error) {
    console.error('Failed to fetch DOB NOW jobs:', error);
    return [];
  }
}

/**
 * Map DOB borough code to name
 */
function mapBorough(code: string): string | null {
  const mapping: Record<string, string> = {
    '1': 'Manhattan',
    '2': 'Bronx',
    '3': 'Brooklyn',
    '4': 'Queens',
    '5': 'Staten Island',
    'MANHATTAN': 'Manhattan',
    'BRONX': 'Bronx',
    'BROOKLYN': 'Brooklyn',
    'QUEENS': 'Queens',
    'STATEN ISLAND': 'Staten Island',
  };
  return mapping[code?.toUpperCase()] || null;
}

/**
 * Determine event type from work type flags
 */
function getEventTypeFromJob(job: DOBNowJob): EventType {
  if (job.general_construction_work_type_ === '1') return 'major_alteration';
  if (job.plumbing_work_type === '1') return 'plumbing';
  if (job.sprinkler_work_type === '1') return 'mechanical';
  if (job.boiler_equipment_work_type_ === '1') return 'equipment_work';
  if (job.earth_work_work_type_ === '1') return 'demolition';
  if (job.scaffold === '1') return 'scaffold';
  if (job.shed === '1') return 'scaffold';
  if (job.fence === '1') return 'minor_alteration';
  return 'other';
}

/**
 * Normalize a DOB NOW job to our event format
 */
export function normalizeDOBNowJob(job: DOBNowJob): NormalizedDOBNowEvent | null {
  const eventType = getEventTypeFromJob(job);

  // Parse date - use current_status_date, fallback to filing_date
  const dateStr = job.current_status_date || job.filing_date || job.first_permit_date;

  // Must have a valid date
  const eventDate = dateStr ? new Date(dateStr) : null;
  if (!eventDate || isNaN(eventDate.getTime())) {
    return null;
  }

  // Build address
  const address = job.house_no && job.street_name
    ? `${job.house_no} ${job.street_name}`.trim()
    : null;

  // Parse coordinates
  const latitude = job.latitude ? parseFloat(job.latitude) : null;
  const longitude = job.longitude ? parseFloat(job.longitude) : null;

  return {
    source: 'dob-now',
    sourceId: job.job_filing_number,
    eventType,
    eventDate,
    bin: job.bin || null,
    address,
    borough: mapBorough(job.borough),
    latitude: latitude && !isNaN(latitude) ? latitude : null,
    longitude: longitude && !isNaN(longitude) ? longitude : null,
    ntaCode: job.nta || null,
    communityDistrict: job.commmunity_board || null,
    jobStatus: job.filing_status || null,
    rawData: job,
  };
}

/**
 * Batch fetch all DOB NOW jobs since a date
 */
export async function fetchAllDOBNowJobsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedDOBNowEvent[]> {
  const { appToken, onProgress } = options;
  const batchSize = 10000;
  const allEvents: NormalizedDOBNowEvent[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const jobs = await fetchDOBNowJobs({
      sinceDate,
      limit: batchSize,
      offset,
      appToken,
    });

    for (const job of jobs) {
      const normalized = normalizeDOBNowJob(job);
      if (normalized) {
        allEvents.push(normalized);
      }
    }

    onProgress?.(allEvents.length);

    if (jobs.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allEvents;
}
