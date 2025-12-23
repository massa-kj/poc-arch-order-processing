import { FastifyInstance } from 'fastify';
import {
  getAllPayments,
  getPaymentsByOrderId,
  getPaymentById,
  processPayment,
  refundPayment,
  getPaymentSummaryByOrderId
} from './db.js';
import {
  ProcessPaymentRequest,
  RefundPaymentRequest,
  ApiError,
  ApiSuccess
} from './types.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', async (req, reply) => {
    return { status: 'ok', service: 'payment', timestamp: new Date().toISOString() };
  });

  // Get all payments (for debugging/admin purposes)
  app.get('/payments', async (req, reply) => {
    try {
      const payments = await getAllPayments();
      return { success: true, data: payments } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error fetching payments');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Get payments for specific order
  app.get('/payments/order/:orderId', async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const payments = await getPaymentsByOrderId(orderId);

      return { success: true, data: payments } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error fetching order payments');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Get specific payment by ID
  app.get('/payments/:paymentId', async (req, reply) => {
    try {
      const { paymentId } = req.params as { paymentId: string };
      const payment = await getPaymentById(paymentId);

      if (!payment) {
        return reply.status(404).send({ error: 'Payment not found' } as ApiError);
      }

      return { success: true, data: payment } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error fetching payment');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Process payment for order
  app.post<{ Body: ProcessPaymentRequest }>('/payments/process', async (req, reply) => {
    try {
      const request = req.body;

      // Validate request
      if (!request.order_id || !request.amount_cents || request.amount_cents <= 0) {
        return reply.status(400).send({
          error: 'Invalid request. order_id and positive amount_cents required'
        } as ApiError);
      }

      if (!request.currency || !request.payment_method) {
        return reply.status(400).send({
          error: 'Invalid request. currency and payment_method required'
        } as ApiError);
      }

      // Validate currency format
      const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY'];
      if (!validCurrencies.includes(request.currency.toUpperCase())) {
        return reply.status(400).send({
          error: `Invalid currency. Supported currencies: ${validCurrencies.join(', ')}`
        } as ApiError);
      }

      // Validate payment method
      const validPaymentMethods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cryptocurrency'];
      if (!validPaymentMethods.includes(request.payment_method.toLowerCase())) {
        return reply.status(400).send({
          error: `Invalid payment method. Supported methods: ${validPaymentMethods.join(', ')}`
        } as ApiError);
      }

      const payment = await processPayment({
        ...request,
        currency: request.currency.toUpperCase(),
        payment_method: request.payment_method.toLowerCase()
      });

      const statusCode = payment.status === 'COMPLETED' ? 201 : 400;
      const message = payment.status === 'COMPLETED'
        ? 'Payment processed successfully'
        : 'Payment processing failed';

      return reply.status(statusCode).send({
        success: payment.status === 'COMPLETED',
        data: payment,
        message
      } as ApiSuccess);

    } catch (error) {
      app.log.error({ error }, 'Error processing payment');

      // Handle specific business logic errors
      if (error instanceof Error && error.message === 'Order not found') {
        return reply.status(404).send({
          error: 'Order not found'
        } as ApiError);
      }

      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Refund payment
  app.post<{ Body: RefundPaymentRequest }>('/payments/refund', async (req, reply) => {
    try {
      const request = req.body;

      // Validate request
      if (!request.payment_id) {
        return reply.status(400).send({
          error: 'Invalid request. payment_id required'
        } as ApiError);
      }

      if (request.amount_cents && request.amount_cents <= 0) {
        return reply.status(400).send({
          error: 'Invalid request. amount_cents must be positive if specified'
        } as ApiError);
      }

      const refund = await refundPayment(request);

      const statusCode = refund.status === 'REFUNDED' ? 201 : 400;
      const message = refund.status === 'REFUNDED'
        ? 'Refund processed successfully'
        : 'Refund processing failed';

      return reply.status(statusCode).send({
        success: refund.status === 'REFUNDED',
        data: refund,
        message
      } as ApiSuccess);

    } catch (error) {
      app.log.error({ error }, 'Error processing refund');

      // Handle specific business logic errors
      if (error instanceof Error) {
        if (error.message === 'Payment not found') {
          return reply.status(404).send({ error: 'Payment not found' } as ApiError);
        }
        if (error.message === 'Can only refund completed payments') {
          return reply.status(400).send({ error: 'Can only refund completed payments' } as ApiError);
        }
      }

      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });

  // Get payment summary for order
  app.get('/payments/order/:orderId/summary', async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const summary = await getPaymentSummaryByOrderId(orderId);

      return { success: true, data: summary } as ApiSuccess;
    } catch (error) {
      app.log.error({ error }, 'Error fetching payment summary');
      return reply.status(500).send({ error: 'Internal server error' } as ApiError);
    }
  });
}
