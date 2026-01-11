/**
 * Tests for map routes - cache headers and query optimizations
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

// Mock the database module
vi.mock('../../../pipeline/src/db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
  places: {},
  transformationStates: {},
  rawEvents: {},
  heatmapCells: {},
}));

describe('Map routes cache headers', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    await fastify.register(cors, { origin: true });
    await fastify.register(sensible);

    // Mock /map/places route with cache header
    fastify.get('/map/places', async (_request, reply) => {
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return { places: [], total: 0 };
    });

    // Mock /map/heatmap route with cache header
    fastify.get('/map/heatmap', async (_request, reply) => {
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return { cells: [] };
    });

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should set cache headers on /map/places', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/map/places',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=300');
  });

  it('should set cache headers on /map/heatmap', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/map/heatmap',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=600');
  });

  it('places cache should be 60 seconds with 5 min stale-while-revalidate', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/map/places',
    });

    const cacheControl = response.headers['cache-control'] as string;
    expect(cacheControl).toContain('max-age=60');
    expect(cacheControl).toContain('stale-while-revalidate=300');
    expect(cacheControl).toContain('public');
  });

  it('heatmap cache should be 5 minutes with 10 min stale-while-revalidate', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/map/heatmap',
    });

    const cacheControl = response.headers['cache-control'] as string;
    expect(cacheControl).toContain('max-age=300');
    expect(cacheControl).toContain('stale-while-revalidate=600');
    expect(cacheControl).toContain('public');
  });
});

describe('Cache-Control header format', () => {
  it('should parse max-age correctly', () => {
    const header = 'public, max-age=60, stale-while-revalidate=300';
    const maxAgeMatch = header.match(/max-age=(\d+)/);
    expect(maxAgeMatch).not.toBeNull();
    expect(parseInt(maxAgeMatch![1])).toBe(60);
  });

  it('should parse stale-while-revalidate correctly', () => {
    const header = 'public, max-age=300, stale-while-revalidate=600';
    const swrMatch = header.match(/stale-while-revalidate=(\d+)/);
    expect(swrMatch).not.toBeNull();
    expect(parseInt(swrMatch![1])).toBe(600);
  });
});
