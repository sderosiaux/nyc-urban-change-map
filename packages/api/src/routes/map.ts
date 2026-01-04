/**
 * Map routes - Places and heatmap for map rendering
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, places, transformationStates, heatmapCells } from '@ucm/pipeline';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { cellToBoundary } from 'h3-js';
import type { PlacesGeoJSON, PlaceFeature, HeatmapResponse, TimeMode, Certainty } from '@ucm/shared';

// Query parameter schemas
const boundsSchema = z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/);

const placesQuerySchema = z.object({
  bounds: boundsSchema,
  zoom: z.coerce.number().min(0).max(22).optional().default(12),
  min_intensity: z.coerce.number().min(0).max(100).optional().default(0),
  certainty: z.string().optional(),
  time_mode: z.enum(['past', 'now', 'future']).optional().default('now'),
  year: z.coerce.number().min(2020).max(2040).optional(),
});

const heatmapQuerySchema = z.object({
  bounds: boundsSchema,
  resolution: z.coerce.number().min(7).max(10).optional().default(8),
});

export const mapRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /map/places - Get places for map rendering
   */
  fastify.get('/places', async (request, reply) => {
    const query = placesQuerySchema.parse(request.query);

    // Parse bounds
    const [swLng, swLat, neLng, neLat] = query.bounds.split(',').map(Number);

    // Build query conditions
    const conditions = [
      gte(places.longitude, swLng!),
      lte(places.longitude, neLng!),
      gte(places.latitude, swLat!),
      lte(places.latitude, neLat!),
    ];

    // Time-based filtering
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0]!;
    const selectedYear = query.year || now.getFullYear();
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    if (query.time_mode === 'past') {
      // Past: disruption ended before or during selected year
      conditions.push(
        sql`${transformationStates.disruptionEnd} IS NOT NULL`,
        sql`${transformationStates.disruptionEnd} <= ${yearEnd}`
      );
    } else if (query.time_mode === 'now') {
      // Now: disruption is currently active (started and not yet ended)
      conditions.push(
        sql`(${transformationStates.disruptionStart} IS NULL OR ${transformationStates.disruptionStart} <= ${nowStr})`,
        sql`(${transformationStates.disruptionEnd} IS NULL OR ${transformationStates.disruptionEnd} >= ${nowStr})`
      );
    } else if (query.time_mode === 'future') {
      // Future: show all projects active at or beyond selected year
      // A project ending in 2032 should show when viewing 2030
      conditions.push(
        sql`${transformationStates.disruptionEnd} IS NOT NULL`,
        sql`${transformationStates.disruptionEnd} >= ${yearStart}`
      );
    }

    // Adjust limit based on zoom level
    // Higher zoom = smaller area = fewer places needed
    // Lower zoom (clusters) = larger area = need more places for representative clustering
    const limit = query.zoom < 14 ? 10000 : 2000;

    // Fetch places with transformation states
    const results = await db
      .select({
        id: places.id,
        geometryJson: places.geometryJson,
        address: places.address,
        intensity: transformationStates.intensity,
        certainty: transformationStates.certainty,
        nature: transformationStates.nature,
        headline: transformationStates.headline,
        disruptionEnd: transformationStates.disruptionEnd,
      })
      .from(places)
      .innerJoin(transformationStates, eq(places.id, transformationStates.placeId))
      .where(and(
        ...conditions,
        gte(transformationStates.intensity, query.min_intensity),
      ))
      // Order by intensity descending to show the most important places
      // This ensures spatially distributed results when limited
      .orderBy(desc(transformationStates.intensity), sql`RANDOM()`)
      .limit(limit);

    // Convert to GeoJSON
    const features: PlaceFeature[] = results.map(place => ({
      type: 'Feature' as const,
      id: place.id,
      geometry: place.geometryJson as PlaceFeature['geometry'],
      properties: {
        id: place.id,
        intensity: place.intensity ?? 0,
        certainty: (place.certainty ?? 'discussion') as Certainty,
        nature: (place.nature ?? 'mixed') as PlaceFeature['properties']['nature'],
        headline: place.headline ?? 'Transformation en cours',
        ...(place.disruptionEnd && { disruptionEnd: place.disruptionEnd }),
      },
    }));

    const response: PlacesGeoJSON = {
      type: 'FeatureCollection',
      features,
      meta: {
        total: features.length,
        clustered: query.zoom < 15,
        timeMode: query.time_mode as TimeMode,
      },
    };

    return response;
  });

  /**
   * GET /map/heatmap - Get heatmap cells
   */
  fastify.get('/heatmap', async (request, reply) => {
    const query = heatmapQuerySchema.parse(request.query);

    // Parse bounds
    const [swLng, swLat, neLng, neLat] = query.bounds.split(',').map(Number);

    // Fetch heatmap cells within bounds
    const cells = await db
      .select()
      .from(heatmapCells)
      .where(and(
        gte(heatmapCells.centerLng, swLng!),
        lte(heatmapCells.centerLng, neLng!),
        gte(heatmapCells.centerLat, swLat!),
        lte(heatmapCells.centerLat, neLat!),
      ));

    const response: HeatmapResponse = {
      cells: cells.map(cell => {
        // Compute boundary from H3 index
        const boundary = cellToBoundary(cell.h3Index, true); // true for [lng, lat] order

        return {
          h3Index: cell.h3Index,
          boundary: boundary as [number, number][],
          avgIntensity: cell.avgIntensity ?? 0,
          maxIntensity: cell.maxIntensity ?? 0,
          placeCount: cell.placeCount ?? 0,
          dominantNature: (cell.dominantNature ?? 'mixed') as HeatmapResponse['cells'][0]['dominantNature'],
        };
      }),
      meta: {
        resolution: query.resolution,
        bounds: {
          sw: [swLng!, swLat!],
          ne: [neLng!, neLat!],
        },
      },
    };

    return response;
  });
};
