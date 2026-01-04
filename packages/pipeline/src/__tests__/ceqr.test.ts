/**
 * Tests for CEQR data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizeCEQRProject, mapCEQRToEventType } from '../ingest/ceqr.js';

describe('mapCEQRToEventType', () => {
  it('should return ceqr_completed for completed projects', () => {
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP001',
      projectname: 'Test',
      projectstatus: 'Completed',
    })).toBe('ceqr_completed');

    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP002',
      projectname: 'Test',
      projectcompleted: '2024-01-01',
    })).toBe('ceqr_completed');
  });

  it('should return ceqr_eis_final for FEIS submitted', () => {
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP003',
      projectname: 'Test',
      feissubmitteddate: '2024-06-01',
    })).toBe('ceqr_eis_final');
  });

  it('should return ceqr_eis_draft for DEIS submitted', () => {
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP004',
      projectname: 'Test',
      deissubmitteddate: '2024-03-01',
    })).toBe('ceqr_eis_draft');
  });

  it('should return ceqr_eas for EAS submitted', () => {
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP005',
      projectname: 'Test',
      eassubmitteddate: '2024-01-01',
    })).toBe('ceqr_eas');
  });

  it('should return ceqr_eas for active projects', () => {
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP006',
      projectname: 'Test',
      projectstatus: 'Active',
    })).toBe('ceqr_eas');

    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP007',
      projectname: 'Test',
      projectstatus: 'In Progress',
    })).toBe('ceqr_eas');
  });

  it('should return null for projects without status or dates', () => {
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP008',
      projectname: 'Test',
    })).toBeNull();
  });

  it('should prioritize status in order: completed > FEIS > DEIS > EAS', () => {
    // FEIS takes precedence over DEIS
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP009',
      projectname: 'Test',
      feissubmitteddate: '2024-06-01',
      deissubmitteddate: '2024-03-01',
      eassubmitteddate: '2024-01-01',
    })).toBe('ceqr_eis_final');

    // Completed takes precedence over all
    expect(mapCEQRToEventType({
      ceqrnumber: '24DCP010',
      projectname: 'Test',
      projectstatus: 'Completed',
      feissubmitteddate: '2024-06-01',
    })).toBe('ceqr_completed');
  });
});

describe('normalizeCEQRProject', () => {
  it('should normalize a CEQR project with all fields', () => {
    const project = {
      ceqrnumber: '24DCP001M',
      projectname: 'Downtown Rezoning',
      projectdescription: 'Large-scale mixed-use development',
      leadagencyname: 'Department of City Planning',
      leadagencyacronym: 'DCP',
      ceqrtype: 'Type I',
      reviewtype: 'EIS',
      projectstatus: 'Active',
      eassubmitteddate: '2024-01-15T00:00:00.000',
      deissubmitteddate: '2024-06-01T00:00:00.000',
      borough: 'MANHATTAN',
      communitydistrict: '01',
    };

    const result = normalizeCEQRProject(project);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('ceqr');
    expect(result!.sourceId).toBe('24DCP001M');
    expect(result!.eventType).toBe('ceqr_eis_draft');
    expect(result!.projectName).toBe('Downtown Rezoning');
    expect(result!.projectDescription).toBe('Large-scale mixed-use development');
    expect(result!.leadAgency).toBe('Department of City Planning');
    expect(result!.ceqrType).toBe('Type I');
    expect(result!.reviewType).toBe('EIS');
    expect(result!.borough).toBe('Manhattan');
    expect(result!.communityDistrict).toBe('01');
  });

  it('should use the most significant date', () => {
    const project = {
      ceqrnumber: '24DCP002Q',
      projectname: 'Queens Project',
      feissubmitteddate: '2024-09-15T00:00:00.000',
      deissubmitteddate: '2024-06-01T00:00:00.000',
      eassubmitteddate: '2024-01-01T00:00:00.000',
    };

    const result = normalizeCEQRProject(project);

    expect(result).not.toBeNull();
    expect(result!.eventDate.getMonth()).toBe(8); // September (FEIS date)
  });

  it('should return null when ceqrnumber is missing', () => {
    const project = {
      projectname: 'Test Project',
      projectstatus: 'Active',
    };

    const result = normalizeCEQRProject(project as any);
    expect(result).toBeNull();
  });

  it('should return null when projectname is missing', () => {
    const project = {
      ceqrnumber: '24DCP003X',
      projectstatus: 'Active',
    };

    const result = normalizeCEQRProject(project as any);
    expect(result).toBeNull();
  });

  it('should handle missing coordinates (CEQR has no coords)', () => {
    const project = {
      ceqrnumber: '24DCP004B',
      projectname: 'Bronx Development',
      projectstatus: 'Active',
      borough: 'BRONX',
    };

    const result = normalizeCEQRProject(project);

    expect(result).not.toBeNull();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
  });

  it('should map borough codes correctly', () => {
    const boroughs = [
      { input: 'MANHATTAN', output: 'Manhattan' },
      { input: 'MN', output: 'Manhattan' },
      { input: 'BROOKLYN', output: 'Brooklyn' },
      { input: 'BK', output: 'Brooklyn' },
      { input: 'QUEENS', output: 'Queens' },
      { input: 'QN', output: 'Queens' },
      { input: 'BRONX', output: 'Bronx' },
      { input: 'BX', output: 'Bronx' },
      { input: 'STATEN ISLAND', output: 'Staten Island' },
      { input: 'SI', output: 'Staten Island' },
    ];

    for (const { input, output } of boroughs) {
      const project = {
        ceqrnumber: `24DCP${input.substring(0, 2)}`,
        projectname: 'Test',
        projectstatus: 'Active',
        borough: input,
      };

      const result = normalizeCEQRProject(project);
      expect(result?.borough).toBe(output);
    }
  });
});
