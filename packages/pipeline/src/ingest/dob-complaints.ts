/**
 * DOB Complaints data ingestion
 * Source: NYC Open Data - DOB Complaints Received
 *
 * Complaints can signal buildings with issues that may lead
 * to violations, enforcement actions, or major work.
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface DOBComplaint {
  complaint_number: string;
  status: string;
  date_entered: string;
  house_number?: string;
  zip_code?: string;
  house_street?: string;
  bin?: string;
  community_board?: string;
  special_district?: string;
  complaint_category?: string;
  unit?: string;
  disposition_date?: string;
  disposition_code?: string;
  inspection_date?: string;
  dobrundate?: string;
  latitude?: string;
  longitude?: string;
  council_district?: string;
  census_tract?: string;
  nta?: string;
  borough?: string;
}

export interface NormalizedComplaint {
  source: 'dob-complaints';
  sourceId: string;
  bin: string | null;
  address: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  ntaCode: string | null;
  communityDistrict: string | null;
  zipCode: string | null;
  dateEntered: Date;
  status: string;
  category: string | null;
  dispositionDate: Date | null;
  dispositionCode: string | null;
  inspectionDate: Date | null;
  rawData: DOBComplaint;
}

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Fetch DOB complaints from NYC Open Data
 */
export async function fetchDOBComplaints(options: {
  sinceDate?: Date;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<DOBComplaint[]> {
  const { sinceDate, limit = 10000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: 'dobrundate DESC', // Order by batch update date
  });

  if (sinceDate) {
    // Use dobrundate for incremental sync - catches updates to existing records
    // Format: YYYYMMDDHHMMSS (e.g., 20260104000000)
    const year = sinceDate.getFullYear();
    const month = String(sinceDate.getMonth() + 1).padStart(2, '0');
    const day = String(sinceDate.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}000000`;
    params.set('$where', `dobrundate >= '${dateStr}'`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.dobComplaints}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`DOB Complaints API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<DOBComplaint[]>;
  } catch (error) {
    console.error('Failed to fetch DOB complaints:', error);
    return [];
  }
}

/**
 * Map DOB borough name to standardized name
 */
function mapBorough(borough: string | undefined): string | null {
  if (!borough) return null;

  const mapping: Record<string, string> = {
    'MANHATTAN': 'Manhattan',
    'BRONX': 'Bronx',
    'BROOKLYN': 'Brooklyn',
    'QUEENS': 'Queens',
    'STATEN ISLAND': 'Staten Island',
  };
  return mapping[borough.toUpperCase()] || null;
}

/**
 * Parse date string safely
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalize a DOB complaint to our format
 */
export function normalizeComplaint(complaint: DOBComplaint): NormalizedComplaint | null {
  if (!complaint.complaint_number || !complaint.date_entered) {
    return null;
  }

  const dateEntered = parseDate(complaint.date_entered);
  if (!dateEntered) {
    return null;
  }

  // Build address
  const address = complaint.house_number && complaint.house_street
    ? `${complaint.house_number} ${complaint.house_street}`.trim()
    : null;

  // Parse coordinates
  const latitude = complaint.latitude ? parseFloat(complaint.latitude) : null;
  const longitude = complaint.longitude ? parseFloat(complaint.longitude) : null;

  return {
    source: 'dob-complaints',
    sourceId: complaint.complaint_number,
    bin: complaint.bin || null,
    address,
    borough: mapBorough(complaint.borough),
    latitude: latitude && !isNaN(latitude) ? latitude : null,
    longitude: longitude && !isNaN(longitude) ? longitude : null,
    ntaCode: complaint.nta || null,
    communityDistrict: complaint.community_board || null,
    zipCode: complaint.zip_code || null,
    dateEntered,
    status: complaint.status,
    category: complaint.complaint_category || null,
    dispositionDate: parseDate(complaint.disposition_date),
    dispositionCode: complaint.disposition_code || null,
    inspectionDate: parseDate(complaint.inspection_date),
    rawData: complaint,
  };
}

/**
 * Batch fetch all complaints since a date
 */
export async function fetchAllComplaintsSince(
  sinceDate: Date,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedComplaint[]> {
  const { appToken, onProgress } = options;
  const batchSize = 10000;
  const allComplaints: NormalizedComplaint[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const complaints = await fetchDOBComplaints({
      sinceDate,
      limit: batchSize,
      offset,
      appToken,
    });

    for (const complaint of complaints) {
      const normalized = normalizeComplaint(complaint);
      if (normalized) {
        allComplaints.push(normalized);
      }
    }

    onProgress?.(allComplaints.length);

    if (complaints.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allComplaints;
}
