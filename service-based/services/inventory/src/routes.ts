import { FastifyInstance } from 'fastify';
import {
  checkAvailability,
  getInventoryItem,
  reserveInventory,
  confirmReservation,
  releaseReservation,
  getAllInventoryItems
} from './db.js';
import {
  CheckAvailabilityRequest,
  ReserveInventoryRequest,
  ReleaseInventoryRequest,
  ApiError,
  ApiSuccess
} from './types.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', async (req, reply) => {
    return { status: 'ok', service: 'inventory', timestamp: new Date().toISOString() };
  });

  // Get all inventory items
  app.get('/inventory', async (req, reply) => {
    try {
      const items = await getAllInventoryItems();
      return { success: true, data: items } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error fetching inventory items');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Get specific inventory item
  app.get('/inventory/:sku', async (req, reply) => {
    try {
      const { sku } = req.params as { sku: string };
      const item = await getInventoryItem(sku);

      if (!item) {
        return reply.status(404).send({ error: 'Item not found' } as ApiError);
      }

      return { success: true, data: item } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error fetching inventory item');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Check availability for specific item
  app.post<{ Body: CheckAvailabilityRequest }>('/inventory/check-availability', async (req, reply) => {
    try {
      const { sku, quantity } = req.body;

      if (!sku || quantity <= 0) {
        return reply.status(400).send({
          error: 'Invalid request. SKU and positive quantity required'
        } as ApiError);
      }

      const availability = await checkAvailability(sku, quantity);
      return { success: true, data: availability } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error checking availability');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Reserve inventory for order
  app.post<{ Body: ReserveInventoryRequest }>('/inventory/reserve', async (req, reply) => {
    try {
      const request = req.body;

      if (!request.order_id || !request.items || request.items.length === 0) {
        return reply.status(400).send({
          error: 'Invalid request. order_id and items required'
        } as ApiError);
      }

      // Validate items
      for (const item of request.items) {
        if (!item.sku || item.quantity <= 0) {
          return reply.status(400).send({
            error: 'Invalid item. SKU and positive quantity required for all items'
          } as ApiError);
        }
      }

      const reservations = await reserveInventory(request);
      return reply.status(201).send({
        success: true,
        data: reservations,
        message: 'Inventory reserved successfully'
      } as ApiSuccess);
    } catch (error) {
      app.log.error({ error }, 'Error reserving inventory');

      // Check if it's a business logic error (insufficient stock)
      if (error instanceof Error && error.message.includes('Insufficient stock')) {
        return reply.status(409).send({
          error: error.message
        } as ApiError);
      }

      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Confirm reservation (when order is confirmed)
  app.post('/inventory/confirm/:orderId', async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };

      await confirmReservation(orderId);
      return {
        success: true,
        message: 'Inventory reservation confirmed'
      } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error confirming reservation');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Release reservation (when order is cancelled or fails)
  app.post<{ Body: ReleaseInventoryRequest }>('/inventory/release', async (req, reply) => {
    try {
      const request = req.body;

      if (!request.order_id) {
        return reply.status(400).send({
          error: 'order_id is required'
        } as ApiError);
      }

      await releaseReservation(request);
      return {
        success: true,
        message: 'Inventory reservation released'
      } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error releasing reservation');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });
}
