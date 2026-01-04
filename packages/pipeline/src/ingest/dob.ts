/**
 * DOB (Department of Buildings) data ingestion
 * Source: NYC Open Data Socrata API
 */

import { NYC_DATA_ENDPOINTS, DOB_JOB_TYPE_MAP } from '@ucm/shared';
import type { EventType } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface DOBPermit {
  job__: string;
  job_doc___: string;
  borough: string;
  bin__: string;
  house__: string;
  street_name: string;
  job_type: string;
  permit_status?: string;
  filing_status?: string;
  filing_date: string;
  issuance_date?: string;
  expiration_date?: string;
  job_start_date?: string;
  owner_s_first_name?: string;
  owner_s_last_name?: string;
  owner_s_business_name?: string;
  zip_code?: string;
  gis_latitude?: string;
  gis_longitude?: string;
  community_board?: string;
  gis_nta_name?: string;
  block?: string;
  lot?: string;
}

export interface NormalizedEvent {
  source: 'dob';
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
  rawData: DOBPermit;
}

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Fetch DOB permits from NYC Open Data
 */
export async function fetchDOBPermits(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<DOBPermit[]> {
  const { sinceDate, limit = 10000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: 'filing_date DESC',
  });

  // Filter by date if provided (format: MM/DD/YYYY for Socrata)
  if (sinceDate) {
    const month = String(sinceDate.getMonth() + 1).padStart(2, '0');
    const day = String(sinceDate.getDate()).padStart(2, '0');
    const year = sinceDate.getFullYear();
    const dateStr = `${month}/${day}/${year}`;
    params.set('$where', `filing_date >= '${dateStr}'`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  // Add app token if provided (increases rate limit)
  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.dobPermits}?${params}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`DOB API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<DOBPermit[]>;
}

/**
 * Parse date in MM/DD/YYYY format
 */
function parseUSDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0]!, 10) - 1;
    const day = parseInt(parts[1]!, 10);
    const year = parseInt(parts[2]!, 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Normalize a DOB permit to our event format
 */
export function normalizeDOBPermit(permit: DOBPermit): NormalizedEvent | null {
  // Map job type to our event type
  const eventType = DOB_JOB_TYPE_MAP[permit.job_type];
  if (!eventType) {
    return null; // Unknown job type, skip
  }

  // Parse filing date (format: MM/DD/YYYY), fallback to issuance_date
  const dateStr = permit.filing_date || permit.issuance_date;
  const eventDate = dateStr ? parseUSDate(dateStr) : null;
  if (!eventDate) {
    return null; // Invalid date, skip
  }

  // Build address
  const address = permit.house__ && permit.street_name
    ? `${permit.house__} ${permit.street_name}`.trim()
    : null;

  // Parse coordinates from gis_* fields
  const latitude = permit.gis_latitude ? parseFloat(permit.gis_latitude) : null;
  const longitude = permit.gis_longitude ? parseFloat(permit.gis_longitude) : null;

  return {
    source: 'dob',
    sourceId: `${permit.job__}-${permit.job_doc___}`,
    eventType,
    eventDate,
    bin: permit.bin__ || null,
    address,
    borough: mapBorough(permit.borough),
    latitude: latitude && !isNaN(latitude) ? latitude : null,
    longitude: longitude && !isNaN(longitude) ? longitude : null,
    ntaCode: permit.gis_nta_name || null,
    communityDistrict: permit.community_board || null,
    rawData: permit,
  };
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
  return mapping[code.toUpperCase()] || null;
}

/**
 * Batch fetch all permits since a date
 */
export async function fetchAllDOBPermitsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedEvent[]> {
  const { appToken, onProgress } = options;
  const batchSize = 10000;
  const allEvents: NormalizedEvent[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const permits = await fetchDOBPermits({
      sinceDate,
      limit: batchSize,
      offset,
      ...(appToken && { appToken }),
    });

    // Normalize and filter valid permits
    for (const permit of permits) {
      const normalized = normalizeDOBPermit(permit);
      if (normalized) {
        allEvents.push(normalized);
      }
    }

    onProgress?.(allEvents.length);

    // Check if there are more results
    if (permits.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allEvents;
}
