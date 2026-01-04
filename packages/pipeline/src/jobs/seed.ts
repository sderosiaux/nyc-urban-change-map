/**
 * Database seeding job
 * Loads fixture data from NYC Open Data samples
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db, places, rawEvents, transformationStates, heatmapCells, initializeDatabase, closeDatabase } from '../db/index.js';
import { normalizeDOBPermit } from '../ingest/dob.js';
import { normalizeDOBNowJob } from '../ingest/dob-now.js';
import { normalizeViolation } from '../ingest/dob-violations.js';
import { normalizeComplaint } from '../ingest/dob-complaints.js';
import { normalizeZAPProject } from '../ingest/zap.js';
import { normalizeCapitalProject } from '../ingest/capital.js';
import { normalizeCEQRProject } from '../ingest/ceqr.js';
import { computeTransformationState, toDbInsert } from '../compute/transformation.js';
import { latLngToCell, cellToLatLng } from 'h3-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', '__fixtures__');

function loadFixture<T>(name: string): T[] {
  const content = readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(content);
}

interface NormalizedEvent {
  source: string;
  sourceId: string;
  eventType: string;
  eventDate: Date;
  bin: string | null;
  address: string | null;
  borough: string | null;
  latitude: number | null;
  longitude: number | null;
  ntaCode: string | null;
  communityDistrict: string | null;
  rawData: unknown;
}

const H3_RESOLUTION = 8;

async function main() {
  console.log('Initializing database...');
  initializeDatabase();

  console.log('Seeding database from fixtures...');

  try {
    // Collect all normalized events
    const allEvents: NormalizedEvent[] = [];

    // DOB Permits
    console.log('  Loading DOB Permits...');
    const dobPermits = loadFixture<any>('dob-permits');
    for (const raw of dobPermits) {
      const normalized = normalizeDOBPermit(raw);
      if (normalized) {
        allEvents.push({
          source: normalized.source,
          sourceId: normalized.sourceId,
          eventType: normalized.eventType,
          eventDate: normalized.eventDate,
          bin: normalized.bin,
          address: normalized.address,
          borough: normalized.borough,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          ntaCode: normalized.ntaCode,
          communityDistrict: normalized.communityDistrict,
          rawData: normalized.rawData,
        });
      }
    }

    // DOB NOW
    console.log('  Loading DOB NOW...');
    const dobNow = loadFixture<any>('dob-now');
    for (const raw of dobNow) {
      const normalized = normalizeDOBNowJob(raw);
      if (normalized) {
        allEvents.push({
          source: normalized.source,
          sourceId: normalized.sourceId,
          eventType: normalized.eventType,
          eventDate: normalized.eventDate,
          bin: normalized.bin,
          address: normalized.address,
          borough: normalized.borough,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          ntaCode: normalized.ntaCode,
          communityDistrict: normalized.communityDistrict,
          rawData: normalized.rawData,
        });
      }
    }

    // DOB Violations
    console.log('  Loading DOB Violations...');
    const violations = loadFixture<any>('dob-violations');
    for (const raw of violations) {
      const normalized = normalizeViolation(raw);
      if (normalized) {
        allEvents.push({
          source: normalized.source,
          sourceId: normalized.sourceId,
          eventType: 'violation',
          eventDate: normalized.issueDate,
          bin: normalized.bin,
          address: normalized.address,
          borough: normalized.borough,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          ntaCode: normalized.ntaCode,
          communityDistrict: normalized.communityDistrict,
          rawData: normalized.rawData,
        });
      }
    }

    // DOB Complaints
    console.log('  Loading DOB Complaints...');
    const complaints = loadFixture<any>('dob-complaints');
    for (const raw of complaints) {
      const normalized = normalizeComplaint(raw);
      if (normalized) {
        allEvents.push({
          source: normalized.source,
          sourceId: normalized.sourceId,
          eventType: 'complaint',
          eventDate: normalized.dateEntered,
          bin: normalized.bin,
          address: normalized.address,
          borough: normalized.borough,
          latitude: null,
          longitude: null,
          ntaCode: null,
          communityDistrict: normalized.communityDistrict,
          rawData: normalized.rawData,
        });
      }
    }

    // ZAP Projects
    console.log('  Loading ZAP Projects...');
    const zap = loadFixture<any>('zap');
    for (const raw of zap) {
      const normalized = normalizeZAPProject(raw);
      if (normalized) {
        allEvents.push({
          source: normalized.source,
          sourceId: normalized.sourceId,
          eventType: normalized.eventType,
          eventDate: normalized.eventDate,
          bin: null,
          address: normalized.projectName, // Use project name as address
          borough: normalized.borough,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          ntaCode: null,
          communityDistrict: normalized.communityDistrict,
          rawData: normalized.rawData,
        });
      }
    }

    // Capital Projects
    console.log('  Loading Capital Projects...');
    const capital = loadFixture<any>('capital');
    for (const raw of capital) {
      const normalized = normalizeCapitalProject(raw);
      if (normalized) {
        allEvents.push({
          source: normalized.source,
          sourceId: normalized.sourceId,
          eventType: normalized.eventType,
          eventDate: normalized.eventDate,
          bin: null,
          address: normalized.projectDescription, // Use project description as address
          borough: null, // Capital doesn't have borough
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          ntaCode: null,
          communityDistrict: null,
          rawData: normalized.rawData,
        });
      }
    }

    // CEQR Projects
    console.log('  Loading CEQR Projects...');
    const ceqr = loadFixture<any>('ceqr');
    for (const raw of ceqr) {
      const normalized = normalizeCEQRProject(raw);
      if (normalized) {
        allEvents.push({
          source: normalized.source,
          sourceId: normalized.sourceId,
          eventType: normalized.eventType,
          eventDate: normalized.eventDate,
          bin: null,
          address: null,
          borough: normalized.borough,
          latitude: null,
          longitude: null,
          ntaCode: null,
          communityDistrict: null,
          rawData: normalized.rawData,
        });
      }
    }

    console.log(`  Loaded ${allEvents.length} events from fixtures`);

    // Group events by location (address or bin)
    const placeMap = new Map<string, {
      address: string | null;
      bin: string | null;
      borough: string | null;
      latitude: number | null;
      longitude: number | null;
      ntaCode: string | null;
      communityDistrict: string | null;
      events: NormalizedEvent[];
    }>();

    for (const event of allEvents) {
      // Use address + borough as key, fallback to bin, fallback to sourceId
      const key = event.address && event.borough
        ? `${event.address}-${event.borough}`
        : event.bin
          ? `bin-${event.bin}`
          : `source-${event.source}-${event.sourceId}`;

      let place = placeMap.get(key);
      if (!place) {
        place = {
          address: event.address,
          bin: event.bin,
          borough: event.borough,
          latitude: event.latitude,
          longitude: event.longitude,
          ntaCode: event.ntaCode,
          communityDistrict: event.communityDistrict,
          events: [],
        };
        placeMap.set(key, place);
      }

      // Update with better data if available
      if (!place.latitude && event.latitude) {
        place.latitude = event.latitude;
        place.longitude = event.longitude;
      }
      if (!place.ntaCode && event.ntaCode) {
        place.ntaCode = event.ntaCode;
      }

      place.events.push(event);
    }

    console.log(`  Created ${placeMap.size} unique places`);

    // Insert places and events
    let placeCount = 0;
    let eventCount = 0;

    for (const [, placeData] of placeMap) {
      // Create geometry
      const geometry = placeData.latitude && placeData.longitude
        ? { type: 'Point', coordinates: [placeData.longitude, placeData.latitude] }
        : { type: 'Point', coordinates: [-73.98, 40.75] }; // Default to NYC center

      // Insert place
      const [place] = await db.insert(places).values({
        geometryJson: geometry,
        geometryType: 'point',
        bin: placeData.bin,
        address: placeData.address,
        borough: placeData.borough,
        ntaCode: placeData.ntaCode,
        communityDistrict: placeData.communityDistrict,
        latitude: placeData.latitude ?? 40.75,
        longitude: placeData.longitude ?? -73.98,
      }).returning();

      placeCount++;

      // Insert events
      for (const event of placeData.events) {
        await db.insert(rawEvents).values({
          placeId: place!.id,
          source: event.source,
          sourceId: event.sourceId,
          eventType: event.eventType,
          eventDate: event.eventDate.toISOString().split('T')[0]!,
          rawData: event.rawData,
        });
        eventCount++;
      }
    }

    console.log(`  Inserted ${placeCount} places and ${eventCount} events`);

    // Compute transformation states
    console.log('Computing transformation states...');

    const allPlaces = await db.query.places.findMany({
      with: {
        rawEvents: true,
      },
    });

    for (const place of allPlaces) {
      const state = computeTransformationState({
        place,
        events: place.rawEvents,
      });

      const dbState = toDbInsert(state);

      await db.insert(transformationStates).values({
        ...dbState,
        computedAt: new Date().toISOString(),
      });
    }

    console.log(`  Computed ${allPlaces.length} transformation states`);

    // Compute heatmap cells
    console.log('Computing heatmap cells...');

    const placesWithStates = await db.query.places.findMany({
      with: {
        transformationState: true,
      },
    });

    const cellData = new Map<string, {
      intensities: number[];
      natures: string[];
      count: number;
      lat: number;
      lng: number;
    }>();

    for (const place of placesWithStates) {
      if (!place.latitude || !place.longitude || !place.transformationState) {
        continue;
      }

      const h3Index = latLngToCell(place.latitude, place.longitude, H3_RESOLUTION);

      let cell = cellData.get(h3Index);
      if (!cell) {
        const [lat, lng] = cellToLatLng(h3Index);
        cell = {
          intensities: [],
          natures: [],
          count: 0,
          lat,
          lng,
        };
        cellData.set(h3Index, cell);
      }

      cell.intensities.push(place.transformationState.intensity);
      if (place.transformationState.nature) {
        cell.natures.push(place.transformationState.nature);
      }
      cell.count++;
    }

    for (const [h3Index, cell] of cellData) {
      const avgIntensity = cell.intensities.reduce((a, b) => a + b, 0) / cell.intensities.length;
      const maxIntensity = Math.max(...cell.intensities);

      const natureCounts = new Map<string, number>();
      for (const nature of cell.natures) {
        natureCounts.set(nature, (natureCounts.get(nature) ?? 0) + 1);
      }
      let dominantNature = 'mixed';
      let maxCount = 0;
      for (const [nature, count] of natureCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominantNature = nature;
        }
      }

      await db.insert(heatmapCells).values({
        h3Index,
        centerLat: cell.lat,
        centerLng: cell.lng,
        avgIntensity,
        maxIntensity,
        placeCount: cell.count,
        dominantNature,
        computedAt: new Date().toISOString(),
      });
    }

    console.log(`  Computed ${cellData.size} heatmap cells`);

    console.log('\nSeeding complete!');
    console.log(`  Places: ${placeCount}`);
    console.log(`  Events: ${eventCount}`);
    console.log(`  Heatmap cells: ${cellData.size}`);

  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    closeDatabase();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
