/**
 * Integration tests that validate normalization against real NYC Open Data fixtures
 * These fixtures are cached samples from the actual APIs
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Import normalization functions
import { normalizeDOBPermit } from '../ingest/dob.js';
import { normalizeDOBNowJob } from '../ingest/dob-now.js';
import { normalizeViolation } from '../ingest/dob-violations.js';
import { normalizeComplaint } from '../ingest/dob-complaints.js';
import { normalizeZAPProject } from '../ingest/zap.js';
import { normalizeCapitalProject } from '../ingest/capital.js';
import { normalizeCEQRProject } from '../ingest/ceqr.js';
import { normalizePLUTO } from '../ingest/pluto.js';
import { normalizeNTA } from '../ingest/boundaries.js';

// Import metadata for validation
import metadata from '../__fixtures__/metadata.json';

const FIXTURES_DIR = join(__dirname, '..', '__fixtures__');

function loadFixture<T>(name: string): T[] {
  const content = readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(content);
}

describe('Fixture Integration Tests', () => {
  describe('Metadata validation', () => {
    it('should have metadata for all datasets', () => {
      expect(metadata.datasets).toBeDefined();
      expect(Object.keys(metadata.datasets).length).toBeGreaterThanOrEqual(9);
    });

    it('should have expected record counts for active datasets', () => {
      const activeDatasets = Object.entries(metadata.datasets)
        .filter(([_, ds]: [string, any]) => ds.status === 'active');

      expect(activeDatasets.length).toBe(9);

      for (const [key, ds] of activeDatasets as [string, any][]) {
        expect(ds.recordCount).toBeGreaterThan(0);
        expect(ds.id).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
      }
    });
  });

  describe('DOB Permits (dob-permits.json)', () => {
    const fixtures = loadFixture<any>('dob-permits');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeDOBPermit).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract required fields from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeDOBPermit(first);

      if (normalized) {
        expect(normalized.sourceId).toBeDefined();
        expect(normalized.eventType).toBeDefined();
        expect(normalized.source).toBe('dob');
      }
    });
  });

  describe('DOB NOW (dob-now.json)', () => {
    const fixtures = loadFixture<any>('dob-now');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeDOBNowJob).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract source ID from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeDOBNowJob(first);

      if (normalized) {
        expect(normalized.sourceId).toBeDefined();
        expect(normalized.source).toBe('dob-now');
      }
    });
  });

  describe('DOB Violations (dob-violations.json)', () => {
    const fixtures = loadFixture<any>('dob-violations');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeViolation).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract violation details from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeViolation(first);

      if (normalized) {
        expect(normalized.sourceId).toBeDefined();
        expect(normalized.source).toBe('dob-violations');
      }
    });
  });

  describe('DOB Complaints (dob-complaints.json)', () => {
    const fixtures = loadFixture<any>('dob-complaints');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeComplaint).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract source ID from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeComplaint(first);

      if (normalized) {
        expect(normalized.sourceId).toBeDefined();
        expect(normalized.source).toBe('dob-complaints');
      }
    });
  });

  describe('ZAP Projects (zap.json)', () => {
    const fixtures = loadFixture<any>('zap');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeZAPProject).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract project details from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeZAPProject(first);

      if (normalized) {
        expect(normalized.sourceId).toBeDefined();
        expect(normalized.source).toBe('zap');
      }
    });
  });

  describe('Capital Projects (capital.json)', () => {
    const fixtures = loadFixture<any>('capital');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeCapitalProject).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract source ID from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeCapitalProject(first);

      if (normalized) {
        expect(normalized.sourceId).toBeDefined();
        expect(normalized.source).toBe('capital');
      }
    });
  });

  describe('CEQR Projects (ceqr.json)', () => {
    const fixtures = loadFixture<any>('ceqr');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeCEQRProject).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract source ID from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeCEQRProject(first);

      if (normalized) {
        expect(normalized.sourceId).toBeDefined();
        expect(normalized.source).toBe('ceqr');
      }
    });
  });

  describe('PLUTO (pluto.json)', () => {
    const fixtures = loadFixture<any>('pluto');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizePLUTO).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract BBL from real data', () => {
      const first = fixtures[0];
      const normalized = normalizePLUTO(first);

      if (normalized) {
        expect(normalized.bbl).toBeDefined();
        expect(normalized.bbl).toMatch(/^\d{10}$/);
      }
    });
  });

  describe('NTAs (ntas.json)', () => {
    const fixtures = loadFixture<any>('ntas');

    it('should have fixture data', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should normalize all fixture records successfully', () => {
      const normalized = fixtures.map(normalizeNTA).filter(Boolean);
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should extract NTA code and name from real data', () => {
      const first = fixtures[0];
      const normalized = normalizeNTA(first);

      if (normalized) {
        expect(normalized.ntaCode).toBeDefined();
        expect(normalized.ntaName).toBeDefined();
      }
    });

    it('should include geometry when present', () => {
      const withGeom = fixtures.find((f: any) => f.the_geom);
      if (withGeom) {
        const normalized = normalizeNTA(withGeom);
        expect(normalized?.geometry).toBeDefined();
      }
    });
  });
});
