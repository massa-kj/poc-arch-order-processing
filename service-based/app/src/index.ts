import Fastify from 'fastify';
import { registerRoutes } from './routes.js';

async function main() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  });

  // Register routes
  await registerRoutes(app);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });

  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';  // Allow external connections in Docker

    await app.listen({ port, host });
    console.log(`Service-based order API running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
