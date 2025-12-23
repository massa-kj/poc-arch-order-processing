import Fastify from 'fastify';
import { registerRoutes } from './routes.js';
import { closePool } from './db.js';

async function main() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  });

  // Register routes
  await registerRoutes(app);

  // Graceful shutdown
  const gracefulShutdown = async () => {
    app.log.info('Inventory Service: Starting graceful shutdown...');
    try {
      await closePool();
      await app.close();
      app.log.info('Inventory Service: Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      app.log.error({ error }, 'Inventory Service: Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  try {
    const port = Number(process.env.PORT) || 3002;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`Inventory Service running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
