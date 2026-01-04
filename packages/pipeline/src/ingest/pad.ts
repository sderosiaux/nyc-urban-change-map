/**
 * PAD (Property Address Directory) data ingestion
 * Source: NYC Open Data - Property Address Directory
 *
 * PAD is the authoritative source for NYC addresses.
 * Maps Address ↔ BBL ↔ BIN ↔ coordinates.
 * Essential for placing events correctly on the map.
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface PADRecord {
  borough: string;
  block: string;
  lot: string;
  bin: string;
  lhnd?: string;              // Low house number
  hhnd?: string;              // High house number
  stname?: string;            // Street name
  addrtype?: string;          // Address type
  validlgcs?: string;         // Valid LGCs
  pession?: string;
  bession?: string;
  lzip?: string;              // Low ZIP
  hzip?: string;              // High ZIP
  bcode?: string;
  session?: string;
  cd?: string;                // Community District
  ct10?: string;              // Census Tract 2010
  cb10?: string;              // Census Block 2010
  ct20?: string;              // Census Tract 2020
  cb20?: string;              // Census Block 2020
  nta?: string;               // NTA code
  ntaname?: string;           // NTA name
  schooldist?: string;
  policeprct?: string;
  firecomp?: string;
  healtharea?: string;
  sanession?: string;
  latitude?: string;
  longitude?: string;
  x_coord?: string;
  y_coord?: string;
}

export interface NormalizedPAD {
  bbl: string;
  bin: string | null;
  borough: string | null;
  address: string | null;
  lowHouseNumber: string | null;
  highHouseNumber: string | null;
  streetName: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  communityDistrict: string | null;
  ntaCode: string | null;
  ntaName: string | null;
  censusTract2020: string | null;
  rawData: PADRecord;
}

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Fetch PAD records from NYC Open Data
 */
export async function fetchPADRecords(options: {
  borough?: string;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<PADRecord[]> {
  const { borough, limit = 10000, offset = 0, appToken } = options;

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
  });

  if (borough) {
    params.set('$where', `borough = '${borough}'`);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.pad}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`PAD API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<PADRecord[]>;
  } catch (error) {
    console.error('Failed to fetch PAD records:', error);
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
 * Build BBL from borough, block, lot
 */
function buildBBL(borough: string, block: string, lot: string): string {
  return `${borough}${block.padStart(5, '0')}${lot.padStart(4, '0')}`;
}

/**
 * Build address from house numbers and street name
 */
function buildAddress(lhnd: string | undefined, hhnd: string | undefined, stname: string | undefined): string | null {
  if (!stname) return null;

  if (lhnd && hhnd && lhnd !== hhnd) {
    return `${lhnd}-${hhnd} ${stname}`;
  } else if (lhnd) {
    return `${lhnd} ${stname}`;
  }

  return null;
}

/**
 * Normalize a PAD record
 */
export function normalizePAD(record: PADRecord): NormalizedPAD | null {
  if (!record.borough || !record.block || !record.lot) {
    return null;
  }

  const latitude = record.latitude ? parseFloat(record.latitude) : null;
  const longitude = record.longitude ? parseFloat(record.longitude) : null;

  return {
    bbl: buildBBL(record.borough, record.block, record.lot),
    bin: record.bin || null,
    borough: mapBorough(record.borough),
    address: buildAddress(record.lhnd, record.hhnd, record.stname),
    lowHouseNumber: record.lhnd || null,
    highHouseNumber: record.hhnd || null,
    streetName: record.stname || null,
    zipCode: record.lzip || null,
    latitude: latitude && !isNaN(latitude) ? latitude : null,
    longitude: longitude && !isNaN(longitude) ? longitude : null,
    communityDistrict: record.cd || null,
    ntaCode: record.nta || null,
    ntaName: record.ntaname || null,
    censusTract2020: record.ct20 || null,
    rawData: record,
  };
}

/**
 * Fetch PAD record by BIN
 */
export async function fetchPADByBIN(
  bin: string,
  options: { appToken?: string } = {}
): Promise<NormalizedPAD | null> {
  const { appToken } = options;

  const params = new URLSearchParams({
    $where: `bin = '${bin}'`,
    $limit: '1',
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.pad}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return null;
    }

    const records = await response.json() as PADRecord[];
    if (records.length === 0) {
      return null;
    }

    return normalizePAD(records[0]!);
  } catch {
    return null;
  }
}

/**
 * Fetch PAD record by BBL
 */
export async function fetchPADByBBL(
  bbl: string,
  options: { appToken?: string } = {}
): Promise<NormalizedPAD[]> {
  const { appToken } = options;

  // Parse BBL to get borough, block, lot
  const borough = bbl.charAt(0);
  const block = bbl.substring(1, 6);
  const lot = bbl.substring(6, 10);

  const params = new URLSearchParams({
    $where: `borough = '${borough}' AND block = '${block}' AND lot = '${lot}'`,
    $limit: '100',
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.pad}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return [];
    }

    const records = await response.json() as PADRecord[];
    return records
      .map(r => normalizePAD(r))
      .filter((r): r is NormalizedPAD => r !== null);
  } catch {
    return [];
  }
}

/**
 * Search PAD by address
 */
export async function searchPADByAddress(
  houseNumber: string,
  streetName: string,
  borough: string,
  options: { appToken?: string } = {}
): Promise<NormalizedPAD[]> {
  const { appToken } = options;

  // Map borough name to code
  const boroughMapping: Record<string, string> = {
    'manhattan': '1',
    'bronx': '2',
    'brooklyn': '3',
    'queens': '4',
    'staten island': '5',
  };
  const boroCode = boroughMapping[borough.toLowerCase()] || borough;

  const params = new URLSearchParams({
    $where: `borough = '${boroCode}' AND stname LIKE '%${streetName.toUpperCase()}%' AND (lhnd = '${houseNumber}' OR hhnd = '${houseNumber}')`,
    $limit: '10',
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.pad}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return [];
    }

    const records = await response.json() as PADRecord[];
    return records
      .map(r => normalizePAD(r))
      .filter((r): r is NormalizedPAD => r !== null);
  } catch {
    return [];
  }
}
