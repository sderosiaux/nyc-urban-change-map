/**
 * Tests for Boundaries data ingestion (NTAs, Community Districts, Boroughs)
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeNTA,
  normalizeCommunityDistrict,
  normalizeBorough,
} from '../ingest/boundaries.js';

describe('normalizeNTA', () => {
  it('should normalize an NTA record with all fields', () => {
    const record = {
      ntacode: 'MN01',
      ntaname: 'Midtown-Midtown South',
      ntaabbrev: 'Midtown',
      ntatype: 'Residential',
      borocode: '1',
      boroname: 'Manhattan',
      cdta2020: 'MN01',
      cdtaname: 'Manhattan Community District 1',
      shape_area: '1234567.89',
      the_geom: {
        type: 'MultiPolygon',
        coordinates: [[[[-73.99, 40.75], [-73.98, 40.75], [-73.98, 40.76], [-73.99, 40.75]]]],
      },
    };

    const result = normalizeNTA(record);

    expect(result).not.toBeNull();
    expect(result!.ntaCode).toBe('MN01');
    expect(result!.ntaName).toBe('Midtown-Midtown South');
    expect(result!.abbreviation).toBe('Midtown');
    expect(result!.type).toBe('Residential');
    expect(result!.boroCode).toBe('1');
    expect(result!.boroName).toBe('Manhattan');
    expect(result!.cdtaCode).toBe('MN01');
    expect(result!.cdtaName).toBe('Manhattan Community District 1');
    expect(result!.shapeArea).toBeCloseTo(1234567.89);
    expect(result!.geometry).not.toBeNull();
  });

  it('should return null when ntacode is missing', () => {
    const record = {
      ntaname: 'Test NTA',
    };

    const result = normalizeNTA(record as any);
    expect(result).toBeNull();
  });

  it('should return null when ntaname is missing', () => {
    const record = {
      ntacode: 'MN99',
    };

    const result = normalizeNTA(record as any);
    expect(result).toBeNull();
  });

  it('should handle missing optional fields', () => {
    const record = {
      ntacode: 'BK01',
      ntaname: 'Downtown Brooklyn',
    };

    const result = normalizeNTA(record);

    expect(result).not.toBeNull();
    expect(result!.abbreviation).toBeNull();
    expect(result!.type).toBeNull();
    expect(result!.boroCode).toBeNull();
    expect(result!.boroName).toBeNull();
    expect(result!.geometry).toBeNull();
  });
});

describe('normalizeCommunityDistrict', () => {
  it('should normalize a Community District record', () => {
    const record = {
      boro_cd: '101',
      shape_area: '987654.32',
      the_geom: {
        type: 'MultiPolygon',
        coordinates: [[[[-73.99, 40.75], [-73.98, 40.75], [-73.98, 40.76], [-73.99, 40.75]]]],
      },
    };

    const result = normalizeCommunityDistrict(record);

    expect(result).not.toBeNull();
    expect(result!.boroCD).toBe('101');
    expect(result!.boroCode).toBe('1');
    expect(result!.districtNumber).toBe('01');
    expect(result!.boroName).toBe('Manhattan');
    expect(result!.displayName).toBe('Manhattan CD 1');
    expect(result!.shapeArea).toBeCloseTo(987654.32);
    expect(result!.geometry).not.toBeNull();
  });

  it('should return null when boro_cd is missing', () => {
    const record = {
      shape_area: '123456',
    };

    const result = normalizeCommunityDistrict(record as any);
    expect(result).toBeNull();
  });

  it('should map all borough codes to correct names', () => {
    const districts = [
      { boro_cd: '101', boroName: 'Manhattan', displayName: 'Manhattan CD 1' },
      { boro_cd: '201', boroName: 'Bronx', displayName: 'Bronx CD 1' },
      { boro_cd: '301', boroName: 'Brooklyn', displayName: 'Brooklyn CD 1' },
      { boro_cd: '401', boroName: 'Queens', displayName: 'Queens CD 1' },
      { boro_cd: '501', boroName: 'Staten Island', displayName: 'Staten Island CD 1' },
    ];

    for (const { boro_cd, boroName, displayName } of districts) {
      const record = { boro_cd };
      const result = normalizeCommunityDistrict(record);
      expect(result?.boroName).toBe(boroName);
      expect(result?.displayName).toBe(displayName);
    }
  });

  it('should handle multi-digit district numbers', () => {
    const record = {
      boro_cd: '312',
    };

    const result = normalizeCommunityDistrict(record);

    expect(result).not.toBeNull();
    expect(result!.districtNumber).toBe('12');
    expect(result!.displayName).toBe('Brooklyn CD 12');
  });
});

describe('normalizeBorough', () => {
  it('should normalize a Borough record', () => {
    const record = {
      boro_code: '1',
      boro_name: 'Manhattan',
      shape_area: '5000000.00',
      the_geom: {
        type: 'MultiPolygon',
        coordinates: [[[[-74.05, 40.70], [-73.90, 40.70], [-73.90, 40.80], [-74.05, 40.70]]]],
      },
    };

    const result = normalizeBorough(record);

    expect(result).not.toBeNull();
    expect(result!.boroCode).toBe('1');
    expect(result!.boroName).toBe('Manhattan');
    expect(result!.shapeArea).toBeCloseTo(5000000.00);
    expect(result!.geometry).not.toBeNull();
  });

  it('should return null when boro_code is missing', () => {
    const record = {
      boro_name: 'Manhattan',
    };

    const result = normalizeBorough(record as any);
    expect(result).toBeNull();
  });

  it('should return null when boro_name is missing', () => {
    const record = {
      boro_code: '1',
    };

    const result = normalizeBorough(record as any);
    expect(result).toBeNull();
  });

  it('should handle missing optional fields', () => {
    const record = {
      boro_code: '2',
      boro_name: 'Bronx',
    };

    const result = normalizeBorough(record);

    expect(result).not.toBeNull();
    expect(result!.shapeArea).toBeNull();
    expect(result!.geometry).toBeNull();
  });

  it('should normalize all NYC boroughs', () => {
    const boroughs = [
      { boro_code: '1', boro_name: 'Manhattan' },
      { boro_code: '2', boro_name: 'Bronx' },
      { boro_code: '3', boro_name: 'Brooklyn' },
      { boro_code: '4', boro_name: 'Queens' },
      { boro_code: '5', boro_name: 'Staten Island' },
    ];

    for (const { boro_code, boro_name } of boroughs) {
      const record = { boro_code, boro_name };
      const result = normalizeBorough(record);
      expect(result).not.toBeNull();
      expect(result!.boroCode).toBe(boro_code);
      expect(result!.boroName).toBe(boro_name);
    }
  });
});
