/**
 * PLUTO data ingestion
 * Source: NYC Open Data - Primary Land Use Tax Lot Output (PLUTO)
 *
 * PLUTO provides context about buildings: zoning, land use,
 * year built, FAR, number of floors, etc.
 * Essential for understanding what exists before changes occur.
 */

import { NYC_DATA_ENDPOINTS } from '@ucm/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface PLUTORecord {
  bbl: string;
  borough: string;
  block?: string;
  lot?: string;
  cd?: string;                    // Community District
  ct2010?: string;                // Census Tract 2010
  cb2010?: string;                // Census Block 2010
  schooldist?: string;
  council?: string;               // City Council District
  zipcode?: string;
  firecomp?: string;
  policeprct?: string;
  healtharea?: string;
  sanitboro?: string;
  sanitsub?: string;
  address?: string;
  zonedist1?: string;             // Primary zoning district
  zonedist2?: string;
  zonedist3?: string;
  zonedist4?: string;
  overlay1?: string;
  overlay2?: string;
  spdist1?: string;               // Special purpose district
  spdist2?: string;
  spdist3?: string;
  ltdheight?: string;             // Limited height district
  splitzone?: string;
  bldgclass?: string;             // Building class
  landuse?: string;               // Land use category
  easession?: string;
  ownertype?: string;
  ownername?: string;
  lotarea?: string;               // Lot area in sq ft
  bldgarea?: string;              // Building area in sq ft
  comarea?: string;               // Commercial area
  resarea?: string;               // Residential area
  officearea?: string;
  retailarea?: string;
  garagearea?: string;
  strgearea?: string;             // Storage area
  factryarea?: string;
  otherarea?: string;
  areasource?: string;
  numbldgs?: string;              // Number of buildings
  numfloors?: string;             // Number of floors
  unitsres?: string;              // Residential units
  unitstotal?: string;            // Total units
  lotfront?: string;
  lotdepth?: string;
  bldgfront?: string;
  bldgdepth?: string;
  ext?: string;
  proxcode?: string;
  irrlotcode?: string;
  lottype?: string;
  bsmtcode?: string;
  assessland?: string;            // Assessed land value
  assesstot?: string;             // Assessed total value
  exempttot?: string;
  yearbuilt?: string;             // Year built
  yearalter1?: string;            // Year of alteration 1
  yearalter2?: string;            // Year of alteration 2
  histdist?: string;              // Historic district
  landmark?: string;
  builtfar?: string;              // Built FAR
  residfar?: string;              // Residential FAR
  commfar?: string;               // Commercial FAR
  facilfar?: string;              // Facility FAR
  boession?: string;
  borocode?: string;
  condession?: string;
  tract2010?: string;
  xcoord?: string;
  ycoord?: string;
  longitude?: string;
  latitude?: string;
  zonemap?: string;
  zmcode?: string;
  sanborn?: string;
  taxmap?: string;
  eession?: string;
  appbbl?: string;
  appdate?: string;
  plutomapid?: string;
  version?: string;
  mappluto_f?: string;
  firm07_flag?: string;
  pfirm15_flag?: string;
}

export interface NormalizedPLUTO {
  bbl: string;
  borough: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  communityDistrict: string | null;
  zipCode: string | null;

  // Zoning
  primaryZoning: string | null;
  overlay: string | null;
  specialDistrict: string | null;
  landUse: string | null;
  buildingClass: string | null;

  // Building characteristics
  yearBuilt: number | null;
  numFloors: number | null;
  numBuildings: number | null;
  residentialUnits: number | null;
  totalUnits: number | null;

  // Area (sq ft)
  lotArea: number | null;
  buildingArea: number | null;
  residentialArea: number | null;
  commercialArea: number | null;

  // FAR
  builtFAR: number | null;
  maxResidentialFAR: number | null;
  maxCommercialFAR: number | null;

  // Value
  assessedTotal: number | null;

  // Flags
  isHistoricDistrict: boolean;
  isLandmark: boolean;

  rawData: PLUTORecord;
}

// =============================================================================
// LAND USE MAPPING
// =============================================================================

export const LAND_USE_CODES: Record<string, string> = {
  '01': 'One & Two Family Buildings',
  '02': 'Multi-Family Walk-Up Buildings',
  '03': 'Multi-Family Elevator Buildings',
  '04': 'Mixed Residential & Commercial Buildings',
  '05': 'Commercial & Office Buildings',
  '06': 'Industrial & Manufacturing',
  '07': 'Transportation & Utility',
  '08': 'Public Facilities & Institutions',
  '09': 'Open Space & Recreation',
  '10': 'Parking Facilities',
  '11': 'Vacant Land',
};

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Fetch PLUTO records from NYC Open Data
 */
export async function fetchPLUTORecords(options: {
  borough?: string;
  limit?: number;
  offset?: number;
  appToken?: string;
}): Promise<PLUTORecord[]> {
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

  const url = `${NYC_DATA_ENDPOINTS.pluto}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`PLUTO API error: ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json() as Promise<PLUTORecord[]>;
  } catch (error) {
    console.error('Failed to fetch PLUTO records:', error);
    return [];
  }
}

/**
 * Map borough code to name
 */
function mapBorough(code: string): string | null {
  const mapping: Record<string, string> = {
    'MN': 'Manhattan',
    'BX': 'Bronx',
    'BK': 'Brooklyn',
    'QN': 'Queens',
    'SI': 'Staten Island',
  };
  return mapping[code?.toUpperCase()] || null;
}

/**
 * Safely parse a number
 */
function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Normalize a PLUTO record
 */
export function normalizePLUTO(record: PLUTORecord): NormalizedPLUTO | null {
  if (!record.bbl) {
    return null;
  }

  // Clean BBL - remove decimals if present (API returns "4110150001.00000000")
  const bbl = record.bbl.split('.')[0] || record.bbl;

  const latitude = parseNumber(record.latitude);
  const longitude = parseNumber(record.longitude);

  return {
    bbl,
    borough: mapBorough(record.borough),
    address: record.address || null,
    latitude,
    longitude,
    communityDistrict: record.cd || null,
    zipCode: record.zipcode || null,

    // Zoning
    primaryZoning: record.zonedist1 || null,
    overlay: record.overlay1 || null,
    specialDistrict: record.spdist1 || null,
    landUse: record.landuse ? LAND_USE_CODES[record.landuse] || record.landuse : null,
    buildingClass: record.bldgclass || null,

    // Building characteristics
    yearBuilt: parseNumber(record.yearbuilt),
    numFloors: parseNumber(record.numfloors),
    numBuildings: parseNumber(record.numbldgs),
    residentialUnits: parseNumber(record.unitsres),
    totalUnits: parseNumber(record.unitstotal),

    // Area
    lotArea: parseNumber(record.lotarea),
    buildingArea: parseNumber(record.bldgarea),
    residentialArea: parseNumber(record.resarea),
    commercialArea: parseNumber(record.comarea),

    // FAR
    builtFAR: parseNumber(record.builtfar),
    maxResidentialFAR: parseNumber(record.residfar),
    maxCommercialFAR: parseNumber(record.commfar),

    // Value
    assessedTotal: parseNumber(record.assesstot),

    // Flags
    isHistoricDistrict: !!record.histdist,
    isLandmark: !!record.landmark,

    rawData: record,
  };
}

/**
 * Fetch all PLUTO records for a borough
 */
export async function fetchAllPLUTOForBorough(
  borough: string,
  options: { appToken?: string; onProgress?: (count: number) => void } = {}
): Promise<NormalizedPLUTO[]> {
  const { appToken, onProgress } = options;
  const batchSize = 10000;
  const allRecords: NormalizedPLUTO[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const records = await fetchPLUTORecords({
      borough,
      limit: batchSize,
      offset,
      appToken,
    });

    for (const record of records) {
      const normalized = normalizePLUTO(record);
      if (normalized) {
        allRecords.push(normalized);
      }
    }

    onProgress?.(allRecords.length);

    if (records.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allRecords;
}

/**
 * Fetch PLUTO record by BBL
 */
export async function fetchPLUTOByBBL(
  bbl: string,
  options: { appToken?: string } = {}
): Promise<NormalizedPLUTO | null> {
  const { appToken } = options;

  const params = new URLSearchParams({
    $where: `bbl = '${bbl}'`,
    $limit: '1',
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  const url = `${NYC_DATA_ENDPOINTS.pluto}?${params}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return null;
    }

    const records = await response.json() as PLUTORecord[];
    if (records.length === 0) {
      return null;
    }

    return normalizePLUTO(records[0]!);
  } catch {
    return null;
  }
}
