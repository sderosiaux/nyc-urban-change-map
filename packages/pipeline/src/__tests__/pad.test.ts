/**
 * Tests for PAD (Property Address Directory) data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizePAD } from '../ingest/pad.js';

describe('normalizePAD', () => {
  it('should normalize a PAD record with all fields', () => {
    const record = {
      borough: '1',
      block: '00123',
      lot: '0045',
      bin: '1000001',
      lhnd: '123',
      hhnd: '125',
      stname: 'BROADWAY',
      lzip: '10001',
      cd: '101',
      nta: 'MN01',
      ntaname: 'Midtown-Midtown South',
      ct20: '001234',
      latitude: '40.7128',
      longitude: '-74.0060',
    };

    const result = normalizePAD(record);

    expect(result).not.toBeNull();
    expect(result!.bbl).toBe('1001230045');
    expect(result!.bin).toBe('1000001');
    expect(result!.borough).toBe('Manhattan');
    expect(result!.address).toBe('123-125 BROADWAY');
    expect(result!.lowHouseNumber).toBe('123');
    expect(result!.highHouseNumber).toBe('125');
    expect(result!.streetName).toBe('BROADWAY');
    expect(result!.zipCode).toBe('10001');
    expect(result!.communityDistrict).toBe('101');
    expect(result!.ntaCode).toBe('MN01');
    expect(result!.ntaName).toBe('Midtown-Midtown South');
    expect(result!.censusTract2020).toBe('001234');
    expect(result!.latitude).toBeCloseTo(40.7128, 4);
    expect(result!.longitude).toBeCloseTo(-74.0060, 4);
  });

  it('should build address with single house number', () => {
    const record = {
      borough: '1',
      block: '00100',
      lot: '0001',
      lhnd: '100',
      stname: 'PARK AVENUE',
    };

    const result = normalizePAD(record);

    expect(result).not.toBeNull();
    expect(result!.address).toBe('100 PARK AVENUE');
  });

  it('should build address with range when lhnd and hhnd differ', () => {
    const record = {
      borough: '3',
      block: '00200',
      lot: '0002',
      lhnd: '100',
      hhnd: '110',
      stname: 'ATLANTIC AVENUE',
    };

    const result = normalizePAD(record);

    expect(result).not.toBeNull();
    expect(result!.address).toBe('100-110 ATLANTIC AVENUE');
  });

  it('should return null when borough is missing', () => {
    const record = {
      block: '00100',
      lot: '0001',
    };

    const result = normalizePAD(record as any);
    expect(result).toBeNull();
  });

  it('should return null when block is missing', () => {
    const record = {
      borough: '1',
      lot: '0001',
    };

    const result = normalizePAD(record as any);
    expect(result).toBeNull();
  });

  it('should return null when lot is missing', () => {
    const record = {
      borough: '1',
      block: '00100',
    };

    const result = normalizePAD(record as any);
    expect(result).toBeNull();
  });

  it('should build BBL with correct padding', () => {
    const testCases = [
      { borough: '1', block: '1', lot: '1', expected: '1000010001' },
      { borough: '2', block: '123', lot: '45', expected: '2001230045' },
      { borough: '3', block: '12345', lot: '1234', expected: '3123451234' },
    ];

    for (const { borough, block, lot, expected } of testCases) {
      const record = { borough, block, lot };
      const result = normalizePAD(record);
      expect(result?.bbl).toBe(expected);
    }
  });

  it('should map all borough codes correctly', () => {
    const boroughs = [
      { code: '1', name: 'Manhattan' },
      { code: '2', name: 'Bronx' },
      { code: '3', name: 'Brooklyn' },
      { code: '4', name: 'Queens' },
      { code: '5', name: 'Staten Island' },
    ];

    for (const { code, name } of boroughs) {
      const record = {
        borough: code,
        block: '00001',
        lot: '0001',
      };

      const result = normalizePAD(record);
      expect(result?.borough).toBe(name);
    }
  });

  it('should handle missing optional fields', () => {
    const record = {
      borough: '4',
      block: '00500',
      lot: '0050',
    };

    const result = normalizePAD(record);

    expect(result).not.toBeNull();
    expect(result!.bin).toBeNull();
    expect(result!.address).toBeNull();
    expect(result!.streetName).toBeNull();
    expect(result!.zipCode).toBeNull();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
    expect(result!.ntaCode).toBeNull();
    expect(result!.ntaName).toBeNull();
  });
});
