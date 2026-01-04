/**
 * Data ingestion job
 * Fetches data from NYC Open Data and stores in database
 */

import { eq } from 'drizzle-orm';
import { db, places, rawEvents, dataSources, closeDatabase, initializeDatabase } from '../db/index.js';
import { fetchAllDOBPermitsSince, type NormalizedEvent } from '../ingest/dob.js';
import { fetchAllDOBNowJobsSince, type NormalizedDOBNowEvent } from '../ingest/dob-now.js';
import { fetchAllZAPProjectsSince, type NormalizedZAPEvent } from '../ingest/zap.js';
import { fetchAllCapitalProjectsSince, type NormalizedCapitalEvent } from '../ingest/capital.js';
import { fetchAllComplaintsSince, type NormalizedComplaint } from '../ingest/dob-complaints.js';
import { fetchAllViolationsSince, type NormalizedViolation } from '../ingest/dob-violations.js';
import { fetchAllCEQRProjectsSince, type NormalizedCEQREvent } from '../ingest/ceqr.js';

const APP_TOKEN = process.env['NYC_OPEN_DATA_TOKEN'];

type AnyNormalizedEvent = NormalizedEvent | NormalizedDOBNowEvent | NormalizedZAPEvent | NormalizedCapitalEvent | NormalizedComplaint | NormalizedViolation | NormalizedCEQREvent;

interface DataSourceConfig {
  name: string;
  fetch: (sinceDate: Date, options: { appToken?: string; onProgress?: (count: number) => void }) => Promise<AnyNormalizedEvent[]>;
}

const DATA_SOURCES: DataSourceConfig[] = [
  {
    name: 'dob-now',
    fetch: (sinceDate, options) => fetchAllDOBNowJobsSince(sinceDate, { appToken: options.appToken, onProgress: options.onProgress }),
  },
  {
    name: 'dob-complaints',
    fetch: (sinceDate, options) => fetchAllComplaintsSince(sinceDate, { appToken: options.appToken, onProgress: options.onProgress }) as Promise<AnyNormalizedEvent[]>,
  },
  {
    name: 'dob-violations',
    fetch: (sinceDate, options) => fetchAllViolationsSince(sinceDate, { appToken: options.appToken, onProgress: options.onProgress }) as Promise<AnyNormalizedEvent[]>,
  },
  {
    name: 'zap',
    fetch: (sinceDate, options) => fetchAllZAPProjectsSince(sinceDate, { appToken: options.appToken, onProgress: options.onProgress }),
  },
  {
    name: 'capital',
    fetch: (sinceDate, options) => fetchAllCapitalProjectsSince(sinceDate, { appToken: options.appToken, onProgress: options.onProgress }),
  },
  {
    name: 'ceqr',
    fetch: (sinceDate, options) => fetchAllCEQRProjectsSince(sinceDate, { appToken: options.appToken, onProgress: options.onProgress }),
  },
];

// Minimum hours between syncs for the same source (default 12h, data updates ~daily)
const MIN_SYNC_INTERVAL_HOURS = parseInt(process.env['MIN_SYNC_INTERVAL_HOURS'] || '12', 10);

async function ingestDataSource(config: DataSourceConfig, forceSync = false): Promise<void> {
  const { name, fetch } = config;

  console.log(`\n--- Starting ${name.toUpperCase()} ingestion ---`);

  // Get or create data source record
  let source = await db.query.dataSources.findFirst({
    where: eq(dataSources.name, name),
  });

  if (!source) {
    const result = await db.insert(dataSources).values({
      name,
      status: 'idle',
      recordCount: 0,
    }).returning();
    source = result[0];
  }

  // Check if source was synced recently (skip if within MIN_SYNC_INTERVAL_HOURS)
  if (!forceSync && source?.lastSync && source.status === 'idle') {
    const lastSyncDate = new Date(source.lastSync);
    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync < MIN_SYNC_INTERVAL_HOURS) {
      console.log(`  Skipping - last synced ${hoursSinceSync.toFixed(1)}h ago (threshold: ${MIN_SYNC_INTERVAL_HOURS}h)`);
      console.log(`  ${source.recordCount} records from ${lastSyncDate.toISOString()}`);
      return;
    }
  }

  // Determine since date (last sync or 1 year ago)
  const defaultSinceDate = new Date();
  defaultSinceDate.setFullYear(defaultSinceDate.getFullYear() - 1);

  const sinceDate = source?.lastSync
    ? new Date(source.lastSync)
    : defaultSinceDate;

  console.log(`Fetching ${name} data since ${sinceDate.toISOString()}...`);

  // Update status to syncing
  await db.update(dataSources)
    .set({ status: 'syncing' })
    .where(eq(dataSources.name, name));

  // Fetch all events
  const events = await fetch(sinceDate, {
    ...(APP_TOKEN && { appToken: APP_TOKEN }),
    onProgress: (count) => {
      console.log(`  Fetched ${count} events...`);
    },
  });

  console.log(`Fetched ${events.length} total ${name} events`);

  // Process events in batches
  let processedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    await processBatch(batch);
    processedCount += batch.length;

    if (processedCount % 1000 === 0) {
      console.log(`  Processed ${processedCount}/${events.length} events...`);
    }
  }

  // Update data source record
  await db.update(dataSources)
    .set({
      status: 'idle',
      lastSync: new Date().toISOString(),
      recordCount: events.length,
      errorMessage: null,
    })
    .where(eq(dataSources.name, name));

  console.log(`${name.toUpperCase()} ingestion complete. Processed ${processedCount} events.`);
}

async function main() {
  const forceSync = process.argv.includes('--force');

  console.log('Initializing database...');
  initializeDatabase();

  console.log('Starting data ingestion for all sources...');
  if (forceSync) {
    console.log('Force sync enabled - ignoring sync interval threshold');
  }

  try {
    for (const config of DATA_SOURCES) {
      try {
        await ingestDataSource(config, forceSync);
      } catch (error) {
        console.error(`${config.name} ingestion failed:`, error);

        // Update data source with error
        await db.update(dataSources)
          .set({
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(dataSources.name, config.name));

        // Continue with other data sources
      }
    }

    console.log('\n=== All data sources ingestion complete ===');

  } finally {
    closeDatabase();
  }
}

function extractEventProperties(event: AnyNormalizedEvent): {
  bin: string | null;
  bbl: string | null;
  address: string | null;
  borough: string | null;
  ntaCode: string | null;
  communityDistrict: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  if (event.source === 'dob') {
    const e = event as NormalizedEvent;
    return {
      bin: e.bin,
      bbl: null,
      address: e.address,
      borough: e.borough,
      ntaCode: e.ntaCode,
      communityDistrict: e.communityDistrict,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  } else if (event.source === 'dob-now') {
    const e = event as NormalizedDOBNowEvent;
    return {
      bin: e.bin,
      bbl: null,
      address: e.address,
      borough: e.borough,
      ntaCode: e.ntaCode,
      communityDistrict: e.communityDistrict,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  } else if (event.source === 'dob-complaints') {
    const e = event as NormalizedComplaint;
    return {
      bin: e.bin,
      bbl: null,
      address: e.address,
      borough: e.borough,
      ntaCode: e.ntaCode,
      communityDistrict: e.communityDistrict,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  } else if (event.source === 'dob-violations') {
    const e = event as NormalizedViolation;
    return {
      bin: e.bin,
      bbl: e.bbl,
      address: e.address,
      borough: e.borough,
      ntaCode: e.ntaCode,
      communityDistrict: e.communityDistrict,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  } else if (event.source === 'zap') {
    const e = event as NormalizedZAPEvent;
    return {
      bin: null,
      bbl: null, // NYC Open Data ZAP doesn't include BBL
      address: null,
      borough: e.borough,
      ntaCode: null,
      communityDistrict: e.communityDistrict,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  } else if (event.source === 'ceqr') {
    const e = event as NormalizedCEQREvent;
    return {
      bin: null,
      bbl: null,
      address: null,
      borough: e.borough,
      ntaCode: null,
      communityDistrict: e.communityDistrict,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  } else {
    const e = event as NormalizedCapitalEvent;
    return {
      bin: null,
      bbl: null,
      address: null,
      borough: null, // CPDB doesn't include borough
      ntaCode: null,
      communityDistrict: null,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  }
}

/**
 * Extract event date and type from different normalized formats
 */
function extractEventMeta(event: AnyNormalizedEvent): { eventDate: Date; eventType: string } {
  if (event.source === 'dob-complaints') {
    const e = event as NormalizedComplaint;
    return { eventDate: e.dateEntered, eventType: 'other' }; // Complaints signal issues
  } else if (event.source === 'dob-violations') {
    const e = event as NormalizedViolation;
    return { eventDate: e.issueDate, eventType: 'other' }; // Violations signal issues
  } else {
    // All other sources have eventDate and eventType
    return { eventDate: (event as NormalizedEvent).eventDate, eventType: (event as NormalizedEvent).eventType };
  }
}

async function processBatch(events: AnyNormalizedEvent[]): Promise<void> {
  for (const event of events) {
    const props = extractEventProperties(event);
    const meta = extractEventMeta(event);

    // Find existing place by BIN or BBL
    let place = props.bin
      ? await db.query.places.findFirst({
          where: eq(places.bin, props.bin),
        })
      : props.bbl
        ? await db.query.places.findFirst({
            where: eq(places.bbl, props.bbl),
          })
        : null;

    if (!place && props.latitude && props.longitude) {
      // Create new place
      const result = await db.insert(places).values({
        geometryJson: {
          type: 'Point',
          coordinates: [props.longitude, props.latitude],
        },
        geometryType: 'point',
        bin: props.bin,
        bbl: props.bbl,
        address: props.address,
        borough: props.borough,
        ntaCode: props.ntaCode,
        communityDistrict: props.communityDistrict,
        latitude: props.latitude,
        longitude: props.longitude,
      }).returning();
      place = result[0];
    }

    if (!place) {
      // Skip events without valid location
      continue;
    }

    // Upsert raw event
    await db.insert(rawEvents)
      .values({
        placeId: place.id,
        source: event.source,
        sourceId: event.sourceId,
        eventType: meta.eventType,
        eventDate: meta.eventDate.toISOString().split('T')[0]!,
        rawData: event.rawData,
      })
      .onConflictDoNothing();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
