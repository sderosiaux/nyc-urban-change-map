/**
 * NYC Boundaries data ingestion
 * Source: NYC Open Data
 *
 * Ingests administrative boundaries:
 * - NTAs (Neighborhood Tabulation Areas) - neighborhood level
 * - Community Districts - administrative/political level
 * - Boroughs - borough level
 *
 * These are used for aggregation and display.
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

// NTA (Neighborhood Tabulation Area) - 2020 version
// Handles both old (ntacode) and new (nta2020) API field names
export interface NTARecord {
  ntacode?: string;
  nta2020?: string;  // New API field name
  ntaname: string;
  ntaabbrev?: string;
  ntatype?: string;
  borocode?: string;
  boroname?: string;
  countyfips?: string;
  cdta2020?: string;
  cdtaname?: string;
  shape_leng?: string;
  shape_area?: string;
  the_geom?: GeoJSONGeometry;
}

export interface NormalizedNTA {
  ntaCode: string;
  ntaName: string;
  abbreviation: string | null;
  type: string | null;
  boroCode: string | null;
  boroName: string | null;
  cdtaCode: string | null;
  cdtaName: string | null;
  shapeArea: number | null;
  geometry: GeoJSONGeometry | null;
}

// Community District
export interface CommunityDistrictRecord {
  boro_cd: string;
  shape_leng?: string;
  shape_area?: string;
  the_geom?: GeoJSONGeometry;
}

export interface NormalizedCommunityDistrict {
  boroCD: string;
  boroCode: string;
  districtNumber: string;
  boroName: string | null;
  displayName: string;
  shapeArea: number | null;
  geometry: GeoJSONGeometry | null;
}

// Borough
export interface BoroughRecord {
  boro_code: string;
  boro_name: string;
  shape_leng?: string;
  shape_area?: string;
  the_geom?: GeoJSONGeometry;
}

export interface NormalizedBorough {
  boroCode: string;
  boroName: string;
  shapeArea: number | null;
  geometry: GeoJSONGeometry | null;
}

// =============================================================================
// NTA INGESTION
// =============================================================================

/**
 * Fetch NTAs from NYC Open Data
 */
export async function fetchNTAs(options: {
  appToken?: string;
}): Promise<NTARecord[]> {
  const { appToken } = options;

  const params = new URLSearchParams({
    $limit: '500',
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.ntas}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`NTA API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<NTARecord[]>;
  } catch (error) {
    console.error('Failed to fetch NTAs:', error);
    return [];
  }
}

/**
 * Normalize an NTA record
 * Handles both old (ntacode) and new (nta2020) API field names
 */
export function normalizeNTA(record: NTARecord): NormalizedNTA | null {
  const ntaCode = record.ntacode || record.nta2020;
  if (!ntaCode || !record.ntaname) {
    return null;
  }

  return {
    ntaCode,
    ntaName: record.ntaname,
    abbreviation: record.ntaabbrev || null,
    type: record.ntatype || null,
    boroCode: record.borocode || null,
    boroName: record.boroname || null,
    cdtaCode: record.cdta2020 || null,
    cdtaName: record.cdtaname || null,
    shapeArea: record.shape_area ? parseFloat(record.shape_area) : null,
    geometry: record.the_geom || null,
  };
}

/**
 * Fetch all NTAs
 */
export async function fetchAllNTAs(options: {
  appToken?: string;
}): Promise<NormalizedNTA[]> {
  const records = await fetchNTAs(options);
  return records
    .map(r => normalizeNTA(r))
    .filter((r): r is NormalizedNTA => r !== null);
}

// =============================================================================
// COMMUNITY DISTRICT INGESTION
// =============================================================================

/**
 * Fetch Community Districts from NYC Open Data
 */
export async function fetchCommunityDistricts(options: {
  appToken?: string;
}): Promise<CommunityDistrictRecord[]> {
  const { appToken } = options;

  const params = new URLSearchParams({
    $limit: '100',
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.communityDistricts}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`Community District API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<CommunityDistrictRecord[]>;
  } catch (error) {
    console.error('Failed to fetch Community Districts:', error);
    return [];
  }
}

/**
 * Map borough code to name
 */
function mapBorough(code: string): string | null {
  const mapping: Record<string, string> = {
    '1': 'Manhattan',
    '2': 'Bronx',
    '3': 'Brooklyn',
    '4': 'Queens',
    '5': 'Staten Island',
  };
  return mapping[code] || null;
}

/**
 * Normalize a Community District record
 */
export function normalizeCommunityDistrict(record: CommunityDistrictRecord): NormalizedCommunityDistrict | null {
  if (!record.boro_cd) {
    return null;
  }

  const boroCode = record.boro_cd.substring(0, 1);
  const districtNumber = record.boro_cd.substring(1);
  const boroName = mapBorough(boroCode);

  return {
    boroCD: record.boro_cd,
    boroCode,
    districtNumber,
    boroName,
    displayName: boroName ? `${boroName} CD ${parseInt(districtNumber, 10)}` : record.boro_cd,
    shapeArea: record.shape_area ? parseFloat(record.shape_area) : null,
    geometry: record.the_geom || null,
  };
}

/**
 * Fetch all Community Districts
 */
export async function fetchAllCommunityDistricts(options: {
  appToken?: string;
}): Promise<NormalizedCommunityDistrict[]> {
  const records = await fetchCommunityDistricts(options);
  return records
    .map(r => normalizeCommunityDistrict(r))
    .filter((r): r is NormalizedCommunityDistrict => r !== null);
}

// =============================================================================
// BOROUGH INGESTION
// =============================================================================

/**
 * Fetch Boroughs from NYC Open Data
 */
export async function fetchBoroughs(options: {
  appToken?: string;
}): Promise<BoroughRecord[]> {
  const { appToken } = options;

  const params = new URLSearchParams({
    $limit: '10',
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.boroughs}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`Borough API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<BoroughRecord[]>;
  } catch (error) {
    console.error('Failed to fetch Boroughs:', error);
    return [];
  }
}

/**
 * Normalize a Borough record
 */
export function normalizeBorough(record: BoroughRecord): NormalizedBorough | null {
  if (!record.boro_code || !record.boro_name) {
    return null;
  }

  return {
    boroCode: record.boro_code,
    boroName: record.boro_name,
    shapeArea: record.shape_area ? parseFloat(record.shape_area) : null,
    geometry: record.the_geom || null,
  };
}

/**
 * Fetch all Boroughs
 */
export async function fetchAllBoroughs(options: {
  appToken?: string;
}): Promise<NormalizedBorough[]> {
  const records = await fetchBoroughs(options);
  return records
    .map(r => normalizeBorough(r))
    .filter((r): r is NormalizedBorough => r !== null);
}

// =============================================================================
// COMBINED FETCH
// =============================================================================

export interface AllBoundaries {
  ntas: NormalizedNTA[];
  communityDistricts: NormalizedCommunityDistrict[];
  boroughs: NormalizedBorough[];
}

/**
 * Fetch all boundary types
 */
export async function fetchAllBoundaries(options: {
  appToken?: string;
}): Promise<AllBoundaries> {
  const [ntas, communityDistricts, boroughs] = await Promise.all([
    fetchAllNTAs(options),
    fetchAllCommunityDistricts(options),
    fetchAllBoroughs(options),
  ]);

  return {
    ntas,
    communityDistricts,
    boroughs,
  };
}
