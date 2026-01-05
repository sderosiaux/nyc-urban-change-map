/**
 * DOB NOW Safety Violations data ingestion
 * Source: NYC Open Data - DOB Safety Violations (855j-jady)
 *
 * These are civil penalties issued through DOB NOW (newer system).
 * Different from BISWeb violations (3h2n-5cm9) which are the older system.
 *
 * Violation codes like VIO-FTC-VT-CAT1-202112-0008636 indicate:
 * - FTC = Failure to Comply
 * - VT = Violation Type
 * - CAT1 = Category 1
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface DOBNowViolation {
  bin?: string;
  violation_issue_date?: string;
  violation_number?: string;
  violation_type?: string;
  violation_remarks?: string;
  violation_status?: string;
  device_number?: string;
  device_type?: string;
  cycle_end_date?: string;
  borough?: string;
  block?: string;
  lot?: string;
  house_number?: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  latitude?: string;
  longitude?: string;
  community_board?: string;
  council_district?: string;
  bbl?: string;
  census_tract_2020?: string;
  nta_2020?: string;
}

export interface NormalizedDOBNowViolation {
  source: 'dob-now-violations';
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
  violationStatus: string | null;
  violationRemarks: string | null;
  deviceNumber: string | null;
  deviceType: string | null;
  rawData: DOBNowViolation;
}

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Fetch DOB NOW Safety Violations from NYC Open Data
 */
export async function fetchDOBNowViolations(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<DOBNowViolation[]> {
  const { sinceDate, limit = 10000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: 'violation_issue_date DESC',
  });

  if (sinceDate) {
    // Format: YYYY-MM-DD
    const dateStr = sinceDate.toISOString().split('T')[0];
    params.set('$where', `violation_issue_date >= '${dateStr}'`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.dobNowViolations}?${params}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`DOB NOW Violations API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<DOBNowViolation[]>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('DOB NOW Violations fetch timed out after 2 minutes');
    } else {
      console.error('Failed to fetch DOB NOW violations:', error);
    }
    return [];
  }
}

/**
 * Map borough name to standardized format
 */
function mapBorough(borough: string | undefined): string | null {
  if (!borough) return null;
  const mapping: Record<string, string> = {
    'MANHATTAN': 'Manhattan',
    'BRONX': 'Bronx',
    'BROOKLYN': 'Brooklyn',
    'QUEENS': 'Queens',
    'STATEN ISLAND': 'Staten Island',
    '1': 'Manhattan',
    '2': 'Bronx',
    '3': 'Brooklyn',
    '4': 'Queens',
    '5': 'Staten Island',
  };
  return mapping[borough.toUpperCase()] || borough;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalize a DOB NOW violation to our format
 */
export function normalizeDOBNowViolation(violation: DOBNowViolation): NormalizedDOBNowViolation | null {
  // Must have violation number and date
  if (!violation.violation_number || !violation.violation_issue_date) {
    return null;
  }

  const issueDate = parseDate(violation.violation_issue_date);
  if (!issueDate) {
    return null;
  }

  // Build address
  const address = violation.house_number && violation.street
    ? `${violation.house_number} ${violation.street}`.trim()
    : null;

  // Parse coordinates
  const latitude = violation.latitude ? parseFloat(violation.latitude) : null;
  const longitude = violation.longitude ? parseFloat(violation.longitude) : null;

  return {
    source: 'dob-now-violations',
    sourceId: violation.violation_number,
    bin: violation.bin || null,
    bbl: violation.bbl || null,
    address,
    borough: mapBorough(violation.borough),
    latitude: latitude && !isNaN(latitude) ? latitude : null,
    longitude: longitude && !isNaN(longitude) ? longitude : null,
    ntaCode: violation.nta_2020 || null,
    communityDistrict: violation.community_board || null,
    issueDate,
    violationType: violation.violation_type || null,
    violationStatus: violation.violation_status || null,
    violationRemarks: violation.violation_remarks || null,
    deviceNumber: violation.device_number || null,
    deviceType: violation.device_type || null,
    rawData: violation,
  };
}

/**
 * Batch fetch all DOB NOW violations since a date
 */
export async function fetchAllDOBNowViolationsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedDOBNowViolation[]> {
  const { appToken, onProgress } = options;
  const batchSize = 5000;
  const allViolations: NormalizedDOBNowViolation[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const violations = await fetchDOBNowViolations({
      sinceDate,
      limit: batchSize,
      offset,
      appToken,
    });

    for (const violation of violations) {
      const normalized = normalizeDOBNowViolation(violation);
      if (normalized) {
        allViolations.push(normalized);
      }
    }

    onProgress?.(allViolations.length);

    if (violations.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allViolations;
}
