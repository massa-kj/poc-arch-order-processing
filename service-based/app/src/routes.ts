import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { saveOrder, getOrder, updateOrder } from './db.js';
import { CreateOrderRequest, OrderParams, ApiError, OrderItem } from './type.js';

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

    if (items.length === 0) {
      return reply.status(400).send({ error: 'At least one item is required' } as ApiError);
    }

    try {
      const order = await saveOrder({
        id: uuid(),
        userId,
        items,
        status: 'PENDING',
      });

      // Transform response to match API format
      const response = {
        id: order.id,
        userId: order.user_id,
        items: order.items.map(item => ({
          sku: item.sku,
          qty: item.quantity
        })),
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      };

      reply.status(201).send(response);
    } catch (error) {
      app.log.error({ error }, 'Error creating order');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // get order
  app.get<{ Params: OrderParams }>('/orders/:id', async (req, reply) => {
    const { id } = req.params;

    try {
      const order = await getOrder(id);

      if (!order) {
        return reply.status(404).send({ error: 'Order not found' } as ApiError);
      }

      // Transform response to match API format
      const response = {
        id: order.id,
        userId: order.user_id,
        items: order.items.map(item => ({
          sku: item.sku,
          qty: item.quantity
        })),
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      };

      return response;
    } catch (error) {
      app.log.error({ error }, 'Error fetching order');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // confirm order
  app.post<{ Params: OrderParams }>('/orders/:id/confirm', async (req, reply) => {
    const { id } = req.params;

    try {
      const updated = await updateOrder(id, { status: 'CONFIRMED' });

      if (!updated) {
        return reply.status(404).send({ error: 'Order not found' } as ApiError);
      }

      // Transform response to match API format
      const response = {
        id: updated.id,
        userId: updated.user_id,
        items: updated.items.map(item => ({
          sku: item.sku,
          qty: item.quantity
        })),
        status: updated.status,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      };

      return response;
    } catch (error) {
      app.log.error({ error }, 'Error confirming order');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });
}
