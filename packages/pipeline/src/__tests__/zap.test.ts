/**
 * Tests for ZAP (Zoning Application Portal) data ingestion
 */

import { describe, it, expect } from 'vitest';
import { normalizeZAPProject, mapZAPActionToEventType } from '../ingest/zap.js';

describe('mapZAPActionToEventType', () => {
  it('should map ULURP actions to event types', () => {
    expect(mapZAPActionToEventType('ULURP', 'Filed')).toBe('ulurp_filed');
    expect(mapZAPActionToEventType('ULURP', 'Completed')).toBe('ulurp_approved');
    expect(mapZAPActionToEventType('ULURP', 'Withdrawn')).toBe('ulurp_denied');
  });

  it('should map non-ULURP actions to zap event types', () => {
    expect(mapZAPActionToEventType('Non-ULURP', 'Filed')).toBe('zap_filed');
    expect(mapZAPActionToEventType('Non-ULURP', 'Completed')).toBe('zap_approved');
    expect(mapZAPActionToEventType(undefined, 'Filed')).toBe('zap_filed');
    expect(mapZAPActionToEventType(undefined, 'Complete')).toBe('zap_approved');
  });

  it('should return null for unknown status', () => {
    expect(mapZAPActionToEventType('ULURP', 'Pending')).toBeNull();
    expect(mapZAPActionToEventType('Non-ULURP', 'Unknown Status')).toBeNull();
  });
});

describe('normalizeZAPProject', () => {
  it('should normalize a ZAP project with ULURP action', () => {
    const project = {
      project_id: 'P2024M0123',
      project_name: 'Brooklyn Rezoning',
      public_status: 'Active',
      project_brief: 'Rezoning for mixed-use development',
      borough: 'Brooklyn',
      ulurp_non: 'ULURP',
      certified_referred: '2024-01-15',
      community_district: 'K01',
      actions: 'ZM,ZC',
    };

    const result = normalizeZAPProject(project);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('zap');
    expect(result!.sourceId).toBe('P2024M0123');
    expect(result!.eventType).toBe('ulurp_filed');
    expect(result!.borough).toBe('Brooklyn');
    expect(result!.latitude).toBeNull(); // NYC Open Data ZAP doesn't have coordinates
    expect(result!.longitude).toBeNull();
  });

  it('should normalize a non-ULURP project', () => {
    const project = {
      project_id: 'P2024Q0456',
      project_name: 'Queens Special Permit',
      public_status: 'Completed',
      project_brief: 'Special permit for community facility',
      borough: 'Queens',
      ulurp_non: 'Non-ULURP',
      certified_referred: '2023-06-01',
      community_district: 'Q07',
    };

    const result = normalizeZAPProject(project);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('zap_approved');
  });

  it('should return null for projects without valid status', () => {
    const project = {
      project_id: 'P2024X0789',
      project_name: 'Test Project',
      public_status: 'Unknown', // Not a tracked status
      borough: 'Manhattan',
      ulurp_non: 'ULURP',
    };

    const result = normalizeZAPProject(project);
    expect(result).toBeNull();
  });

  it('should handle missing coordinates gracefully', () => {
    const project = {
      project_id: 'P2024M0999',
      project_name: 'No Coords Project',
      public_status: 'Filed',
      borough: 'Manhattan',
      ulurp_non: 'Non-ULURP',
    };

    const result = normalizeZAPProject(project);

    expect(result).not.toBeNull();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
  });

  it('should parse date correctly', () => {
    const project = {
      project_id: 'P2024B0111',
      project_name: 'Date Test',
      public_status: 'Complete',
      borough: 'Bronx',
      ulurp_non: 'ULURP',
      certified_referred: '2024-03-15T00:00:00.000Z',
    };

    const result = normalizeZAPProject(project);

    expect(result).not.toBeNull();
    expect(result!.eventDate.getFullYear()).toBe(2024);
    expect(result!.eventDate.getUTCMonth()).toBe(2); // March is 2 (0-indexed)
    expect(result!.eventDate.getUTCDate()).toBe(15);
  });
});
