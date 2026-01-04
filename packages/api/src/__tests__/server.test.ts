/**
 * Tests for Fastify server configuration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

describe('Server configuration', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    await fastify.register(cors, { origin: true });
    await fastify.register(sensible);

    // Add a test route
    fastify.get('/health', async () => ({ status: 'ok' }));

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should respond to health check', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('should have CORS enabled', async () => {
    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('should return 404 for unknown routes', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/unknown',
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Error handling', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    await fastify.register(sensible);

    // Route that throws an error
    fastify.get('/error', async () => {
      throw new Error('Test error');
    });

    // Route that returns not found
    fastify.get('/notfound', async (_, reply) => {
      return reply.notFound('Resource not found');
    });

    // Route that returns bad request
    fastify.get('/badrequest', async (_, reply) => {
      return reply.badRequest('Invalid parameters');
    });

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should handle internal server errors', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/error',
    });

    expect(response.statusCode).toBe(500);
  });

  it('should handle not found errors', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/notfound',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('Resource not found');
  });

  it('should handle bad request errors', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/badrequest',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Invalid parameters');
  });
});

describe('Content-Type handling', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });

    fastify.get('/json', async () => ({ data: 'test' }));

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return JSON content type by default', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/json',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });
});
