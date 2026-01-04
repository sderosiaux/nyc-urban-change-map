/**
 * Compute job
 * Calculates transformation states for all places
 */

import { eq, sql } from 'drizzle-orm';
import { db, places, rawEvents, transformationStates, heatmapCells, closeDatabase } from '../db/index.js';
import { computeTransformationState, toDbInsert } from '../compute/transformation.js';
import { latLngToCell, cellToBoundary, cellToLatLng } from 'h3-js';

const H3_RESOLUTION = 8; // ~460m hexagons

async function main() {
  console.log('Starting transformation computation...');

  try {
    // Get all places with their events
    const allPlaces = await db.query.places.findMany({
      with: {
        rawEvents: true,
      },
    });

    console.log(`Computing transformations for ${allPlaces.length} places...`);

    let processedCount = 0;
    const batchSize = 100;

    // Process in batches
    for (let i = 0; i < allPlaces.length; i += batchSize) {
      const batch = allPlaces.slice(i, i + batchSize);

      for (const place of batch) {
        const state = computeTransformationState({
          place,
          events: place.rawEvents,
        });

        const dbState = toDbInsert(state);

        // Upsert transformation state
        await db.insert(transformationStates)
          .values({
            ...dbState,
            computedAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: transformationStates.placeId,
            set: {
              ...dbState,
              computedAt: new Date().toISOString(),
            },
          });

        processedCount++;
      }

      if (processedCount % 500 === 0) {
        console.log(`  Processed ${processedCount}/${allPlaces.length} places...`);
      }
    }

    console.log(`Transformation computation complete. Processed ${processedCount} places.`);

    // Compute heatmap aggregates
    await computeHeatmapCells();

    console.log('All computations complete.');

  } catch (error) {
    console.error('Computation failed:', error);
    throw error;
  } finally {
    closeDatabase();
  }
}

async function computeHeatmapCells(): Promise<void> {
  console.log('Computing heatmap cells...');

  // Get all places with transformation states
  const placesWithStates = await db.query.places.findMany({
    with: {
      transformationState: true,
    },
    where: (p, { isNotNull }) => isNotNull(p.latitude),
  });

  // Group by H3 cell
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

  console.log(`  Found ${cellData.size} H3 cells...`);

  // Clear existing heatmap data
  await db.delete(heatmapCells);

  // Insert new heatmap data
  for (const [h3Index, cell] of cellData) {
    const avgIntensity = cell.intensities.reduce((a, b) => a + b, 0) / cell.intensities.length;
    const maxIntensity = Math.max(...cell.intensities);

    // Find dominant nature (mode)
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

  console.log(`  Inserted ${cellData.size} heatmap cells.`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
