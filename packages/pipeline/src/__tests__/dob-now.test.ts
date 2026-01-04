/**
 * Tests for DOB NOW data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizeDOBNowJob } from '../ingest/dob-now.js';

describe('normalizeDOBNowJob', () => {
  it('should normalize a DOB NOW job with all fields', () => {
    const job = {
      job_filing_number: 'B00123456',
      doc_number: '01',
      borough: 'MANHATTAN',
      bin: '1000001',
      house_no: '123',
      street_name: 'BROADWAY',
      job_type: 'NB',
      job_status: 'E',
      job_status_descrp: 'Permit Issued - Entire',
      filing_date: '2024-01-15T00:00:00.000',
      latitude: '40.7128',
      longitude: '-74.0060',
      community_board: '101',
      nta_name: 'Midtown',
    };

    const result = normalizeDOBNowJob(job);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('dob-now');
    expect(result!.sourceId).toBe('B00123456-01');
    expect(result!.eventType).toBe('new_building');
    expect(result!.address).toBe('123 BROADWAY');
    expect(result!.borough).toBe('Manhattan');
    expect(result!.latitude).toBeCloseTo(40.7128, 4);
    expect(result!.longitude).toBeCloseTo(-74.0060, 4);
    expect(result!.jobStatus).toBe('Permit Issued - Entire');
  });

  it('should handle borough code mapping', () => {
    const job = {
      job_filing_number: 'B00123457',
      borough: '3',
      job_type: 'A1',
      filing_date: '2024-02-01T00:00:00.000',
    };

    const result = normalizeDOBNowJob(job);

    expect(result).not.toBeNull();
    expect(result!.borough).toBe('Brooklyn');
    expect(result!.eventType).toBe('major_alteration');
  });

  it('should fallback to pre_filing_date when filing_date is missing', () => {
    const job = {
      job_filing_number: 'B00123458',
      borough: 'QUEENS',
      job_type: 'DM',
      pre_filing_date: '2024-03-10T00:00:00.000',
    };

    const result = normalizeDOBNowJob(job);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('demolition');
    expect(result!.eventDate.getFullYear()).toBe(2024);
    expect(result!.eventDate.getMonth()).toBe(2); // March is 2 (0-indexed)
  });

  it('should default to "other" event type for unknown job type', () => {
    const job = {
      job_filing_number: 'B00123459',
      borough: 'MANHATTAN',
      job_type: 'UNKNOWN',
      filing_date: '2024-01-15T00:00:00.000',
    };

    const result = normalizeDOBNowJob(job);
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('other');
  });

  it('should use current date when no date is available', () => {
    const job = {
      job_filing_number: 'B00123460',
      borough: 'MANHATTAN',
      job_type: 'NB',
    };

    const before = new Date();
    const result = normalizeDOBNowJob(job);
    const after = new Date();

    expect(result).not.toBeNull();
    expect(result!.eventDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result!.eventDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should handle missing coordinates gracefully', () => {
    const job = {
      job_filing_number: 'B00123461',
      borough: 'BRONX',
      job_type: 'A2',
      filing_date: '2024-04-01T00:00:00.000',
    };

    const result = normalizeDOBNowJob(job);

    expect(result).not.toBeNull();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
  });

  it('should map all supported job types', () => {
    const jobTypes = [
      { type: 'NB', expected: 'new_building' },
      { type: 'A1', expected: 'major_alteration' },
      { type: 'A2', expected: 'minor_alteration' },
      { type: 'DM', expected: 'demolition' },
      { type: 'SG', expected: 'scaffold' },
      { type: 'EW', expected: 'equipment_work' },
      { type: 'PL', expected: 'plumbing' },
    ];

    for (const { type, expected } of jobTypes) {
      const job = {
        job_filing_number: `B00${type}`,
        borough: 'MANHATTAN',
        job_type: type,
        filing_date: '2024-01-01T00:00:00.000',
      };

      const result = normalizeDOBNowJob(job);
      expect(result?.eventType).toBe(expected);
    }
  });
});
