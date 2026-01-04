/**
 * DOB Violations data ingestion
 * Source: NYC Open Data - DOB Violations
 *
 * Violations indicate problems with buildings - can signal
 * buildings at risk of major work or demolition.
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface DOBViolation {
  isn_dob_bis_viol: string;
  boro: string;
  bin?: string;
  block?: string;
  lot?: string;
  issue_date?: string;
  violation_type_code?: string;
  violation_type?: string;
  violation_category?: string;
  description?: string;
  ecb_number?: string;
  number?: string;
  device_number?: string;
  disposition_date?: string;
  disposition_comments?: string;
  house_number?: string;
  street?: string;
  nta?: string;
  latitude?: string;
  longitude?: string;
  community_board?: string;
}

export interface NormalizedViolation {
  source: 'dob-violations';
  sourceId: string;
  bin: string | null;
  bbl: string | null;
  address: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  ntaCode: string | null;
  communityDistrict: string | null;
  issueDate: Date;
  violationType: string | null;
  violationCategory: string | null;
  description: string | null;
  isECB: boolean;
  rawData: DOBViolation;
}

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Fetch DOB violations from NYC Open Data
 */
export async function fetchDOBViolations(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<DOBViolation[]> {
  const { sinceDate, limit = 10000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: 'issue_date DESC',
  });

  if (sinceDate) {
    // DOB Violations uses YYYYMMDD format for issue_date
    const year = sinceDate.getFullYear();
    const month = String(sinceDate.getMonth() + 1).padStart(2, '0');
    const day = String(sinceDate.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    params.set('$where', `issue_date >= '${dateStr}' AND issue_date IS NOT NULL`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.dobViolations}?${params}`;

  try {
    // Add timeout to prevent hanging on slow responses
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`DOB Violations API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<DOBViolation[]>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('DOB Violations fetch timed out after 2 minutes');
    } else {
      console.error('Failed to fetch DOB violations:', error);
    }
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
 * Parse date in various formats (YYYYMMDD, ISO, etc.)
 */
function parseDate(dateStr: string): Date | null {
  // Try YYYYMMDD format first
  if (/^\d{8}$/.test(dateStr)) {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try standard date parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalize a DOB violation to our format
 */
export function normalizeViolation(violation: DOBViolation): NormalizedViolation | null {
  // Parse issue date
  if (!violation.issue_date) {
    return null;
  }

  const issueDate = parseDate(violation.issue_date);
  if (!issueDate) {
    return null;
  }

  // Build address
  const address = violation.house_number && violation.street
    ? `${violation.house_number} ${violation.street}`.trim()
    : null;

  // Build BBL from block/lot
  const bbl = violation.boro && violation.block && violation.lot
    ? `${violation.boro}${violation.block.padStart(5, '0')}${violation.lot.padStart(4, '0')}`
    : null;

  // Parse coordinates
  const latitude = violation.latitude ? parseFloat(violation.latitude) : null;
  const longitude = violation.longitude ? parseFloat(violation.longitude) : null;

  return {
    source: 'dob-violations',
    sourceId: violation.isn_dob_bis_viol,
    bin: violation.bin || null,
    bbl,
    address,
    borough: mapBorough(violation.boro),
    latitude: latitude && !isNaN(latitude) ? latitude : null,
    longitude: longitude && !isNaN(longitude) ? longitude : null,
    ntaCode: violation.nta || null,
    communityDistrict: violation.community_board || null,
    issueDate,
    violationType: violation.violation_type || null,
    violationCategory: violation.violation_category || null,
    description: violation.description || null,
    isECB: !!violation.ecb_number,
    rawData: violation,
  };
}

/**
 * Batch fetch all violations since a date
 */
export async function fetchAllViolationsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedViolation[]> {
  const { appToken, onProgress } = options;
  const batchSize = 5000; // Smaller batches to avoid connection issues
  const allViolations: NormalizedViolation[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const violations = await fetchDOBViolations({
      sinceDate,
      limit: batchSize,
      offset,
      appToken,
    });

    for (const violation of violations) {
      const normalized = normalizeViolation(violation);
      if (normalized) {
        allViolations.push(normalized);
      }
    }

    onProgress?.(allViolations.length);

    if (violations.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
      // Longer delay to avoid rate limiting and connection issues
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allViolations;
}
