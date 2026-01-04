/**
 * Tests for DOB Violations data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizeViolation } from '../ingest/dob-violations.js';

describe('normalizeViolation', () => {
  it('should normalize a violation with all fields', () => {
    const violation = {
      isn_dob_bis_viol: 'V123456789',
      boro: '1',
      bin: '1000001',
      block: '00123',
      lot: '0045',
      issue_date: '2024-01-15T00:00:00.000',
      violation_type_code: 'LL2004',
      violation_type: 'Local Law',
      violation_category: 'V*-DOB VIOLATION - ACTIVE',
      description: 'Illegal conversion of cellar',
      house_number: '123',
      street: 'MAIN STREET',
      nta: 'MN01',
      latitude: '40.7128',
      longitude: '-74.0060',
      community_board: '101',
    };

    const result = normalizeViolation(violation);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('dob-violations');
    expect(result!.sourceId).toBe('V123456789');
    expect(result!.bin).toBe('1000001');
    expect(result!.bbl).toBe('1001230045');
    expect(result!.address).toBe('123 MAIN STREET');
    expect(result!.borough).toBe('Manhattan');
    expect(result!.latitude).toBeCloseTo(40.7128, 4);
    expect(result!.longitude).toBeCloseTo(-74.0060, 4);
    expect(result!.violationType).toBe('Local Law');
    expect(result!.violationCategory).toBe('V*-DOB VIOLATION - ACTIVE');
    expect(result!.description).toBe('Illegal conversion of cellar');
  });

  it('should handle ECB violations', () => {
    const violation = {
      isn_dob_bis_viol: 'V987654321',
      boro: '3',
      issue_date: '2024-02-20T00:00:00.000',
      violation_type: 'ECB',
      ecb_number: 'ECB123456',
    };

    const result = normalizeViolation(violation);

    expect(result).not.toBeNull();
    expect(result!.borough).toBe('Brooklyn');
    expect(result!.isECB).toBe(true);
  });

  it('should return null when issue_date is missing', () => {
    const violation = {
      isn_dob_bis_viol: 'V111111111',
      boro: '1',
    };

    const result = normalizeViolation(violation);
    expect(result).toBeNull();
  });

  it('should build BBL correctly from components', () => {
    const violation = {
      isn_dob_bis_viol: 'V222222222',
      boro: '4',
      block: '01234',
      lot: '0001',
      issue_date: '2024-03-01T00:00:00.000',
    };

    const result = normalizeViolation(violation);

    expect(result).not.toBeNull();
    expect(result!.bbl).toBe('4012340001');
    expect(result!.borough).toBe('Queens');
  });

  it('should handle missing coordinates gracefully', () => {
    const violation = {
      isn_dob_bis_viol: 'V333333333',
      boro: '5',
      issue_date: '2024-04-01T00:00:00.000',
    };

    const result = normalizeViolation(violation);

    expect(result).not.toBeNull();
    expect(result!.borough).toBe('Staten Island');
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
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
      const violation = {
        isn_dob_bis_viol: `V${code}00000`,
        boro: code,
        issue_date: '2024-01-01T00:00:00.000',
      };

      const result = normalizeViolation(violation);
      expect(result?.borough).toBe(name);
    }
  });
});
