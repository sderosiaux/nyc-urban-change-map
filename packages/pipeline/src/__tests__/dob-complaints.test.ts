/**
 * Tests for DOB Complaints data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizeComplaint } from '../ingest/dob-complaints.js';

describe('normalizeComplaint', () => {
  it('should normalize a complaint with all fields', () => {
    const complaint = {
      complaint_number: 'C12345678',
      status: 'ACTIVE',
      date_entered: '2024-01-15T00:00:00.000',
      house_number: '123',
      house_street: 'BROADWAY',
      bin: '1000001',
      community_board: '101',
      complaint_category: '45',
      disposition_date: '2024-02-15T00:00:00.000',
      disposition_code: 'A1',
      inspection_date: '2024-01-20T00:00:00.000',
      latitude: '40.7128',
      longitude: '-74.0060',
      nta: 'MN01',
      borough: 'MANHATTAN',
      zip_code: '10001',
    };

    const result = normalizeComplaint(complaint);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('dob-complaints');
    expect(result!.sourceId).toBe('C12345678');
    expect(result!.bin).toBe('1000001');
    expect(result!.address).toBe('123 BROADWAY');
    expect(result!.borough).toBe('Manhattan');
    expect(result!.latitude).toBeCloseTo(40.7128, 4);
    expect(result!.longitude).toBeCloseTo(-74.0060, 4);
    expect(result!.status).toBe('ACTIVE');
    expect(result!.category).toBe('45');
    expect(result!.zipCode).toBe('10001');
  });

  it('should parse dates correctly', () => {
    const complaint = {
      complaint_number: 'C11111111',
      status: 'CLOSED',
      date_entered: '2024-06-15T00:00:00.000',
      borough: 'BROOKLYN',
      disposition_date: '2024-07-20T00:00:00.000',
      inspection_date: '2024-06-20T00:00:00.000',
    };

    const result = normalizeComplaint(complaint);

    expect(result).not.toBeNull();
    expect(result!.dateEntered.getFullYear()).toBe(2024);
    expect(result!.dateEntered.getMonth()).toBe(5); // June is 5 (0-indexed)
    expect(result!.dispositionDate?.getMonth()).toBe(6); // July is 6
    expect(result!.inspectionDate?.getMonth()).toBe(5);
  });

  it('should return null when complaint_number is missing', () => {
    const complaint = {
      status: 'ACTIVE',
      date_entered: '2024-01-15T00:00:00.000',
      borough: 'MANHATTAN',
    };

    const result = normalizeComplaint(complaint as any);
    expect(result).toBeNull();
  });

  it('should return null when date_entered is missing', () => {
    const complaint = {
      complaint_number: 'C22222222',
      status: 'ACTIVE',
      borough: 'MANHATTAN',
    };

    const result = normalizeComplaint(complaint as any);
    expect(result).toBeNull();
  });

  it('should handle missing optional fields', () => {
    const complaint = {
      complaint_number: 'C33333333',
      status: 'ACTIVE',
      date_entered: '2024-03-01T00:00:00.000',
    };

    const result = normalizeComplaint(complaint);

    expect(result).not.toBeNull();
    expect(result!.address).toBeNull();
    expect(result!.bin).toBeNull();
    expect(result!.borough).toBeNull();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
    expect(result!.category).toBeNull();
    expect(result!.dispositionDate).toBeNull();
    expect(result!.inspectionDate).toBeNull();
  });

  it('should map all borough names correctly', () => {
    const boroughs = [
      { input: 'MANHATTAN', output: 'Manhattan' },
      { input: 'BRONX', output: 'Bronx' },
      { input: 'BROOKLYN', output: 'Brooklyn' },
      { input: 'QUEENS', output: 'Queens' },
      { input: 'STATEN ISLAND', output: 'Staten Island' },
    ];

    for (const { input, output } of boroughs) {
      const complaint = {
        complaint_number: `C${input.substring(0, 3)}`,
        status: 'ACTIVE',
        date_entered: '2024-01-01T00:00:00.000',
        borough: input,
      };

      const result = normalizeComplaint(complaint);
      expect(result?.borough).toBe(output);
    }
  });
});
