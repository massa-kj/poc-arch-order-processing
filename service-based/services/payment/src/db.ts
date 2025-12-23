import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  PaymentTransaction,
  ProcessPaymentRequest,
  RefundPaymentRequest,
} from './types.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/orders',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Payment Service: Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
  process.exit(-1);
});

// === Payment Transaction Operations ===

export async function getAllPayments(): Promise<PaymentTransaction[]> {
  const query = `
    SELECT * FROM payments
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query);
  return result.rows;
}

export async function getPaymentsByOrderId(orderId: string): Promise<PaymentTransaction[]> {
  const query = `
    SELECT * FROM payments
    WHERE order_id = $1
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [orderId]);
  return result.rows;
}

export async function getPaymentById(paymentId: string): Promise<PaymentTransaction | null> {
  const query = `
    SELECT * FROM payments
    WHERE id = $1
  `;

  const result = await pool.query(query, [paymentId]);
  return result.rows[0] || null;
}

export async function processPayment(request: ProcessPaymentRequest): Promise<PaymentTransaction> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if order exists
    const orderCheck = await client.query('SELECT id FROM orders WHERE id = $1', [request.order_id]);
    if (orderCheck.rows.length === 0) {
      throw new Error('Order not found');
    }

    // Create payment transaction
    const paymentId = uuidv4();
    const externalTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simulate payment processing (in real world, this would call external payment service)
    const isPaymentSuccessful = await simulatePaymentProcessing(request);

    const status = isPaymentSuccessful ? 'COMPLETED' : 'FAILED';

    const insertQuery = `
      INSERT INTO payments (
        id, order_id, amount_cents, currency, status,
        payment_method, external_transaction_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      paymentId,
      request.order_id,
      request.amount_cents,
      request.currency,
      status,
      request.payment_method,
      externalTransactionId
    ];

    const result = await client.query(insertQuery, values);

    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function refundPayment(request: RefundPaymentRequest): Promise<PaymentTransaction> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get original payment
    const originalPayment = await getPaymentById(request.payment_id);
    if (!originalPayment) {
      throw new Error('Payment not found');
    }

    if (originalPayment.status !== 'COMPLETED') {
      throw new Error('Can only refund completed payments');
    }

    // Create refund transaction
    const refundId = uuidv4();
    const refundAmount = request.amount_cents || originalPayment.amount_cents;
    const externalTransactionId = `rfnd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simulate refund processing
    const isRefundSuccessful = await simulateRefundProcessing(originalPayment, refundAmount);

    const status = isRefundSuccessful ? 'REFUNDED' : 'FAILED';

    const insertQuery = `
      INSERT INTO payments (
        id, order_id, amount_cents, currency, status,
        payment_method, external_transaction_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      refundId,
      originalPayment.order_id,
      -refundAmount, // Negative amount for refund
      originalPayment.currency,
      status,
      originalPayment.payment_method,
      externalTransactionId
    ];

    const result = await client.query(insertQuery, values);

    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getPaymentSummaryByOrderId(orderId: string): Promise<{
  total_paid: number;
  total_refunded: number;
  net_amount: number;
  payment_count: number;
  latest_status: string;
}> {
  const query = `
    SELECT
      COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) as total_paid,
      COALESCE(ABS(SUM(CASE WHEN amount_cents < 0 THEN amount_cents ELSE 0 END)), 0) as total_refunded,
      COALESCE(SUM(amount_cents), 0) as net_amount,
      COUNT(*) as payment_count,
      (SELECT status FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1) as latest_status
    FROM payments
    WHERE order_id = $1 AND status IN ('COMPLETED', 'REFUNDED')
  `;

  const result = await pool.query(query, [orderId]);
  return result.rows[0] || {
    total_paid: 0,
    total_refunded: 0,
    net_amount: 0,
    payment_count: 0,
    latest_status: null
  };
}

// === Helper Functions ===

// Simulate external payment processing
async function simulatePaymentProcessing(request: ProcessPaymentRequest): Promise<boolean> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

  // Simulate different payment methods with different success rates
  const successRates: Record<string, number> = {
    'credit_card': 0.95,
    'debit_card': 0.97,
    'paypal': 0.92,
    'bank_transfer': 0.98,
    'cryptocurrency': 0.85
  };

  const successRate = successRates[request.payment_method] || 0.90;

  // Simulate failure for very large amounts (over $10000)
  if (request.amount_cents > 1000000) {
    return Math.random() < 0.5; // 50% success rate for large amounts
  }

  return Math.random() < successRate;
}

// Simulate external refund processing
async function simulateRefundProcessing(originalPayment: PaymentTransaction, refundAmount: number): Promise<boolean> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));

  // Refunds generally have higher success rates
  return Math.random() < 0.98;
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await pool.end();
  console.log('Payment Service: Database connection closed');
}
