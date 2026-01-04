/**
 * Tests for Capital Projects data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizeCapitalProject, mapProjectCategory } from '../ingest/capital.js';

describe('mapProjectCategory', () => {
  it('should identify infrastructure projects', () => {
    expect(mapProjectCategory('Fixed Asset')).toBe('infrastructure');
    expect(mapProjectCategory('Lump Sum')).toBe('infrastructure');
    expect(mapProjectCategory('ITT, Vehicles, and Equipment')).toBe('infrastructure');
  });

  it('should return infrastructure for any category', () => {
    expect(mapProjectCategory('Unknown Category')).toBe('infrastructure');
    expect(mapProjectCategory('')).toBe('infrastructure');
    expect(mapProjectCategory(undefined)).toBe('infrastructure');
  });
});

describe('normalizeCapitalProject', () => {
  it('should normalize a capital project', () => {
    const project = {
      maprojid: '850PW187PR01',
      projectid: 'PW187PR01',
      description: 'Street Reconstruction on Main Ave',
      magencyname: 'Department of Transportation',
      magencyacro: 'DOT',
      typecategory: 'Fixed Asset',
      plannedcommit_total: '5000000',
      mindate: '2024-01-15T00:00:00.000',
      the_geom: {
        type: 'MultiPoint',
        coordinates: [[-73.9851, 40.7589]],
      },
    };

    const result = normalizeCapitalProject(project);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('capital');
    expect(result!.sourceId).toBe('850PW187PR01');
    expect(result!.eventType).toBe('capital_project');
    expect(result!.projectDescription).toBe('Street Reconstruction on Main Ave');
    expect(result!.managingAgency).toBe('Department of Transportation');
    expect(result!.agencyAcronym).toBe('DOT');
    expect(result!.latitude).toBeCloseTo(40.7589, 4);
    expect(result!.longitude).toBeCloseTo(-73.9851, 4);
    expect(result!.totalCost).toBe(5000000);
  });

  it('should handle missing coordinates', () => {
    const project = {
      maprojid: 'HW99999',
      description: 'Test Project',
      magencyname: 'Parks Department',
      typecategory: 'Fixed Asset',
    };

    const result = normalizeCapitalProject(project);

    expect(result).not.toBeNull();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
  });

  it('should handle missing cost', () => {
    const project = {
      maprojid: 'HW88888',
      description: 'No Cost Project',
      magencyname: 'Parks Department',
      typecategory: 'Fixed Asset',
      the_geom: {
        type: 'MultiPoint',
        coordinates: [[-73.7949, 40.7282]],
      },
    };

    const result = normalizeCapitalProject(project);

    expect(result).not.toBeNull();
    expect(result!.totalCost).toBeNull();
  });

  it('should parse date correctly', () => {
    const project = {
      maprojid: 'HW77777',
      description: 'Date Test Project',
      magencyname: 'Department of Transportation',
      typecategory: 'Fixed Asset',
      mindate: '2024-06-15T00:00:00.000Z',
      the_geom: {
        type: 'MultiPoint',
        coordinates: [[-73.8648, 40.8448]],
      },
    };

    const result = normalizeCapitalProject(project);

    expect(result).not.toBeNull();
    expect(result!.eventDate.getFullYear()).toBe(2024);
    expect(result!.eventDate.getUTCMonth()).toBe(5); // June is 5 (0-indexed)
  });

  it('should return null for projects without required fields', () => {
    const project = {
      // Missing maprojid
      description: 'Invalid Project',
      magencyname: 'Unknown',
    };

    const result = normalizeCapitalProject(project as any);
    expect(result).toBeNull();
  });
});
