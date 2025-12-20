import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { saveOrder, getOrder, updateOrder } from './db.js';
import { CreateOrderRequest, OrderParams, ApiError } from './type.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check endpoint for production monitoring
  app.get('/health', async (req, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // create order
  app.post<{ Body: CreateOrderRequest }>('/orders', async (req, reply) => {
    const { userId, items = [] } = req.body;

    // Basic validation
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' } as ApiError);
    }

    const order = {
      id: uuid(),
      userId,
      items,
      status: 'PENDING' as const,
    };

    saveOrder(order);
    reply.status(201).send(order);
  });

  // get order
  app.get<{ Params: OrderParams }>('/orders/:id', async (req, reply) => {
    const { id } = req.params;
    const order = getOrder(id);

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' } as ApiError);
    }

    return order;
  });

  // confirm order
  app.post<{ Params: OrderParams }>('/orders/:id/confirm', async (req, reply) => {
    const { id } = req.params;
    const updated = updateOrder(id, { status: 'CONFIRMED' });

    if (!updated) {
      return reply.status(404).send({ error: 'Order not found' } as ApiError);
    }

    return updated;
  });
}
