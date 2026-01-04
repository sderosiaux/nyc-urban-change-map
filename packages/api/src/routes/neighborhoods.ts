/**
 * Neighborhoods routes - Aggregate stats by neighborhood
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, places, transformationStates } from '@ucm/pipeline';
import { eq, sql, desc } from 'drizzle-orm';
import type { NeighborhoodStats, TransformationNature } from '@ucm/shared';

const querySchema = z.object({
  borough: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

export const neighborhoodsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /neighborhoods - Get neighborhood stats
   */
  fastify.get('/', async (request, reply) => {
    const { borough, limit } = querySchema.parse(request.query);

    // Aggregate by NTA
    const stats = await db
      .select({
        ntaCode: places.ntaCode,
        ntaName: places.ntaName,
        borough: places.borough,
        placeCount: sql<number>`count(distinct ${places.id})`,
        avgIntensity: sql<number>`avg(${transformationStates.intensity})`,
        maxIntensity: sql<number>`max(${transformationStates.intensity})`,
        activeTransformations: sql<number>`count(case when ${transformationStates.intensity} > 30 then 1 end)`,
      })
      .from(places)
      .leftJoin(transformationStates, eq(places.id, transformationStates.placeId))
      .where(borough ? eq(places.borough, borough) : undefined)
      .groupBy(places.ntaCode, places.ntaName, places.borough)
      .orderBy(desc(sql`avg(${transformationStates.intensity})`))
      .limit(limit);

    const neighborhoods: NeighborhoodStats[] = stats
      .filter(s => s.ntaCode && s.ntaName)
      .map(s => ({
        ntaCode: s.ntaCode!,
        ntaName: s.ntaName!,
        borough: s.borough ?? 'Unknown',
        placeCount: Number(s.placeCount) || 0,
        avgIntensity: Math.round(Number(s.avgIntensity) || 0),
        maxIntensity: Number(s.maxIntensity) || 0,
        dominantNature: 'mixed' as TransformationNature, // Would need separate query
        activeTransformations: Number(s.activeTransformations) || 0,
      }));

    return {
      neighborhoods,
      total: neighborhoods.length,
      borough: borough ?? 'all',
    };
  });

  /**
   * GET /neighborhoods/:code - Get specific neighborhood details
   */
  fastify.get('/:code', async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.params);

    // Get neighborhood stats
    const stats = await db
      .select({
        ntaCode: places.ntaCode,
        ntaName: places.ntaName,
        borough: places.borough,
        placeCount: sql<number>`count(distinct ${places.id})`,
        avgIntensity: sql<number>`avg(${transformationStates.intensity})`,
        maxIntensity: sql<number>`max(${transformationStates.intensity})`,
        activeTransformations: sql<number>`count(case when ${transformationStates.intensity} > 30 then 1 end)`,
      })
      .from(places)
      .leftJoin(transformationStates, eq(places.id, transformationStates.placeId))
      .where(eq(places.ntaCode, code))
      .groupBy(places.ntaCode, places.ntaName, places.borough);

    if (stats.length === 0 || !stats[0]?.ntaCode) {
      return reply.notFound('Neighborhood not found');
    }

    const s = stats[0];

    // Get top places in neighborhood
    const topPlaces = await db
      .select({
        id: places.id,
        address: places.address,
        intensity: transformationStates.intensity,
        headline: transformationStates.headline,
      })
      .from(places)
      .leftJoin(transformationStates, eq(places.id, transformationStates.placeId))
      .where(eq(places.ntaCode, code))
      .orderBy(desc(transformationStates.intensity))
      .limit(10);

    return {
      ntaCode: s.ntaCode,
      ntaName: s.ntaName,
      borough: s.borough ?? 'Unknown',
      placeCount: Number(s.placeCount) || 0,
      avgIntensity: Math.round(Number(s.avgIntensity) || 0),
      maxIntensity: Number(s.maxIntensity) || 0,
      activeTransformations: Number(s.activeTransformations) || 0,
      topPlaces: topPlaces.map(p => ({
        id: p.id,
        address: p.address ?? 'Unknown',
        intensity: p.intensity ?? 0,
        headline: p.headline ?? 'Transformation en cours',
      })),
    };
  });
};
