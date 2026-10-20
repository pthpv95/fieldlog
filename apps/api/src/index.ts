import Fastify from 'fastify';
import cors from '@fastify/cors';
import { syncRoutes } from './routes/sync.js';
import { healthRoutes } from './routes/health.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

export async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(cors, {
    origin: true,
  });

  await fastify.register(healthRoutes);
  await fastify.register(syncRoutes, { prefix: '/sync' });

  return fastify;
}

async function start() {
  try {
    const fastify = await createServer();
    
    await fastify.listen({
      port: PORT,
      host: HOST,
    });

    console.log(`🚀 API server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
