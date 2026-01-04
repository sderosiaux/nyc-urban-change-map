/**
 * Fastify server for Urban Change Map API
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { mapRoutes } from './routes/map.js';
import { placesRoutes } from './routes/places.js';
import { searchRoutes } from './routes/search.js';
import { neighborhoodsRoutes } from './routes/neighborhoods.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main() {
  const server = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Plugins
  await server.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  await server.register(sensible);

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes
  await server.register(mapRoutes, { prefix: '/api/v1/map' });
  await server.register(placesRoutes, { prefix: '/api/v1/places' });
  await server.register(searchRoutes, { prefix: '/api/v1/search' });
  await server.register(neighborhoodsRoutes, { prefix: '/api/v1/neighborhoods' });

  // Start server
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down...`);
      await server.close();
      process.exit(0);
    });
  }
}

main();
