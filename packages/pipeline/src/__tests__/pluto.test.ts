/**
 * Tests for PLUTO data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizePLUTO, LAND_USE_CODES } from '../ingest/pluto.js';

describe('LAND_USE_CODES', () => {
  it('should have all expected land use codes', () => {
    expect(LAND_USE_CODES['01']).toBe('One & Two Family Buildings');
    expect(LAND_USE_CODES['02']).toBe('Multi-Family Walk-Up Buildings');
    expect(LAND_USE_CODES['03']).toBe('Multi-Family Elevator Buildings');
    expect(LAND_USE_CODES['04']).toBe('Mixed Residential & Commercial Buildings');
    expect(LAND_USE_CODES['05']).toBe('Commercial & Office Buildings');
    expect(LAND_USE_CODES['06']).toBe('Industrial & Manufacturing');
    expect(LAND_USE_CODES['07']).toBe('Transportation & Utility');
    expect(LAND_USE_CODES['08']).toBe('Public Facilities & Institutions');
    expect(LAND_USE_CODES['09']).toBe('Open Space & Recreation');
    expect(LAND_USE_CODES['10']).toBe('Parking Facilities');
    expect(LAND_USE_CODES['11']).toBe('Vacant Land');
  });
});

describe('normalizePLUTO', () => {
  it('should normalize a PLUTO record with all fields', () => {
    const record = {
      bbl: '1000010001',
      borough: 'MN',
      address: '123 BROADWAY',
      cd: '101',
      zipcode: '10001',
      zonedist1: 'C5-3',
      overlay1: 'MiD',
      spdist1: 'MiD',
      landuse: '04',
      bldgclass: 'O4',
      yearbuilt: '1920',
      numfloors: '15',
      numbldgs: '1',
      unitsres: '50',
      unitstotal: '75',
      lotarea: '5000',
      bldgarea: '75000',
      resarea: '50000',
      comarea: '25000',
      builtfar: '15.0',
      residfar: '10.0',
      commfar: '15.0',
      assesstot: '5000000',
      histdist: 'Ladies Mile',
      landmark: 'Y',
      latitude: '40.7128',
      longitude: '-74.0060',
    };

    const result = normalizePLUTO(record);

    expect(result).not.toBeNull();
    expect(result!.bbl).toBe('1000010001');
    expect(result!.borough).toBe('Manhattan');
    expect(result!.address).toBe('123 BROADWAY');
    expect(result!.communityDistrict).toBe('101');
    expect(result!.zipCode).toBe('10001');
    expect(result!.primaryZoning).toBe('C5-3');
    expect(result!.overlay).toBe('MiD');
    expect(result!.specialDistrict).toBe('MiD');
    expect(result!.landUse).toBe('Mixed Residential & Commercial Buildings');
    expect(result!.buildingClass).toBe('O4');
    expect(result!.yearBuilt).toBe(1920);
    expect(result!.numFloors).toBe(15);
    expect(result!.numBuildings).toBe(1);
    expect(result!.residentialUnits).toBe(50);
    expect(result!.totalUnits).toBe(75);
    expect(result!.lotArea).toBe(5000);
    expect(result!.buildingArea).toBe(75000);
    expect(result!.residentialArea).toBe(50000);
    expect(result!.commercialArea).toBe(25000);
    expect(result!.builtFAR).toBe(15.0);
    expect(result!.maxResidentialFAR).toBe(10.0);
    expect(result!.maxCommercialFAR).toBe(15.0);
    expect(result!.assessedTotal).toBe(5000000);
    expect(result!.isHistoricDistrict).toBe(true);
    expect(result!.isLandmark).toBe(true);
    expect(result!.latitude).toBeCloseTo(40.7128, 4);
    expect(result!.longitude).toBeCloseTo(-74.0060, 4);
  });

  it('should return null when BBL is missing', () => {
    const record = {
      borough: 'MN',
      address: '123 BROADWAY',
    };

    const result = normalizePLUTO(record as any);
    expect(result).toBeNull();
  });

  it('should handle missing optional fields', () => {
    const record = {
      bbl: '2000020002',
      borough: 'BX',
    };

    const result = normalizePLUTO(record);

    expect(result).not.toBeNull();
    expect(result!.borough).toBe('Bronx');
    expect(result!.address).toBeNull();
    expect(result!.yearBuilt).toBeNull();
    expect(result!.numFloors).toBeNull();
    expect(result!.isHistoricDistrict).toBe(false);
    expect(result!.isLandmark).toBe(false);
  });

  it('should map all borough codes correctly', () => {
    const boroughs = [
      { code: 'MN', name: 'Manhattan' },
      { code: 'BX', name: 'Bronx' },
      { code: 'BK', name: 'Brooklyn' },
      { code: 'QN', name: 'Queens' },
      { code: 'SI', name: 'Staten Island' },
    ];

    for (const { code, name } of boroughs) {
      const record = {
        bbl: `${code}00001`,
        borough: code,
      };

      const result = normalizePLUTO(record);
      expect(result?.borough).toBe(name);
    }
  });

  it('should handle raw land use codes not in mapping', () => {
    const record = {
      bbl: '3000030003',
      borough: 'BK',
      landuse: '99', // Not in mapping
    };

    const result = normalizePLUTO(record);

    expect(result).not.toBeNull();
    expect(result!.landUse).toBe('99'); // Returns raw code
  });

  it('should parse numeric values correctly', () => {
    const record = {
      bbl: '4000040004',
      borough: 'QN',
      yearbuilt: '2020',
      numfloors: '3',
      lotarea: '2500.5',
      bldgarea: '5000',
    };

    const result = normalizePLUTO(record);

    expect(result).not.toBeNull();
    expect(result!.yearBuilt).toBe(2020);
    expect(result!.numFloors).toBe(3);
    expect(result!.lotArea).toBe(2500.5);
    expect(result!.buildingArea).toBe(5000);
  });
});
