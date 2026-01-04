/**
 * Search routes - Address and neighborhood search
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, places, transformationStates } from '@ucm/pipeline';
import { eq, ilike, and, gte, sql } from 'drizzle-orm';

const querySchema = z.object({
  q: z.string().min(2),
  radius: z.coerce.number().min(100).max(5000).optional().default(500),
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

interface SearchResult {
  id: string;
  type: 'place' | 'neighborhood';
  name: string;
  address?: string;
  neighborhood?: string;
  borough: string;
  latitude: number;
  longitude: number;
  intensity?: number;
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /search - Search for places by address or neighborhood
   */
  fastify.get('/', async (request, reply) => {
    const { q, radius, limit } = querySchema.parse(request.query);

    const searchTerm = `%${q}%`;

    // Search places by address
    const placeResults = await db
      .select({
        id: places.id,
        address: places.address,
        ntaName: places.ntaName,
        borough: places.borough,
        latitude: places.latitude,
        longitude: places.longitude,
        intensity: transformationStates.intensity,
      })
      .from(places)
      .leftJoin(transformationStates, eq(places.id, transformationStates.placeId))
      .where(ilike(places.address, searchTerm))
      .limit(limit);

    // Search by neighborhood name if no address results
    let neighborhoodResults: typeof placeResults = [];
    if (placeResults.length === 0) {
      neighborhoodResults = await db
        .select({
          id: places.id,
          address: places.address,
          ntaName: places.ntaName,
          borough: places.borough,
          latitude: places.latitude,
          longitude: places.longitude,
          intensity: transformationStates.intensity,
        })
        .from(places)
        .leftJoin(transformationStates, eq(places.id, transformationStates.placeId))
        .where(ilike(places.ntaName, searchTerm))
        .limit(limit);
    }

    // Combine and format results
    const results: SearchResult[] = [
      ...placeResults.map(p => ({
        id: p.id,
        type: 'place' as const,
        name: p.address ?? 'Unknown address',
        address: p.address ?? undefined,
        neighborhood: p.ntaName ?? undefined,
        borough: p.borough ?? 'Unknown',
        latitude: p.latitude ?? 0,
        longitude: p.longitude ?? 0,
        intensity: p.intensity ?? undefined,
      })),
      ...neighborhoodResults.map(p => ({
        id: p.id,
        type: 'neighborhood' as const,
        name: p.ntaName ?? 'Unknown neighborhood',
        address: p.address ?? undefined,
        neighborhood: p.ntaName ?? undefined,
        borough: p.borough ?? 'Unknown',
        latitude: p.latitude ?? 0,
        longitude: p.longitude ?? 0,
        intensity: p.intensity ?? undefined,
      })),
    ];

    // Remove duplicates
    const uniqueResults = results.filter((r, i, arr) =>
      arr.findIndex(x => x.id === r.id) === i
    );

    return {
      query: q,
      results: uniqueResults,
      total: uniqueResults.length,
    };
  });
};
