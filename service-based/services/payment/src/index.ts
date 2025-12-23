import Fastify from 'fastify';
import { registerRoutes } from './routes.js';
import { closeDatabase } from './db.js';

const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = Fastify({
  logger: {
    level: 'info'
  }
});

// Register error handler
app.setErrorHandler(async (error, request, reply) => {
  app.log.error({ error, request: request.url }, 'Unhandled error');

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    return reply.status(500).send({ error: 'Internal server error' });
  }

  return reply.status(500).send({
    error: 'Internal server error',
    details: error.message
  });
});

// Register routes
await registerRoutes(app);

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await app.close();
    await closeDatabase();
    app.log.info('Payment Service shutdown complete');
    process.exit(0);
  } catch (error) {
    app.log.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Payment Service running on http://${HOST}:${PORT}`);
    console.log(`Payment Service running on http://${HOST}:${PORT}`);
  } catch (error) {
    app.log.error({ error }, 'Failed to start Payment Service');
    process.exit(1);
  }
};

start();
