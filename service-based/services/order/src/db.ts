import { Pool } from 'pg';
import { Order, OrderItem, OrderWithItems } from './type.js';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function saveOrder(order: {
  id: string;
  userId: string;
  items: { sku: string; qty: number }[];
  status: 'PENDING' | 'CONFIRMED';
}): Promise<OrderWithItems> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert order
    const orderResult = await client.query(
      'INSERT INTO orders (id, user_id, status) VALUES ($1, $2, $3) RETURNING *',
      [order.id, order.userId, order.status]
    );

    const savedOrder: Order = orderResult.rows[0];

    // Insert order items
    const orderItems: OrderItem[] = [];
    for (const item of order.items) {
      const itemResult = await client.query(
        'INSERT INTO order_items (order_id, sku, quantity) VALUES ($1, $2, $3) RETURNING *',
        [order.id, item.sku, item.qty]
      );
      orderItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...savedOrder,
      items: orderItems
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrder(id: string): Promise<OrderWithItems | null> {
  const client = await pool.connect();

  try {
    // Get order
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order: Order = orderResult.rows[0];

    // Get order items
    const itemsResult = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
      [id]
    );

    const items: OrderItem[] = itemsResult.rows;

    return {
      ...order,
      items
    };
  } finally {
    client.release();
  }
}

export async function updateOrder(
  id: string,
  data: Partial<Pick<Order, 'status'>>
): Promise<OrderWithItems | null> {
  const client = await pool.connect();

  try {
    // Update order
    const orderResult = await client.query(
      'UPDATE orders SET status = COALESCE($2, status), updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id, data.status]
    );

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order: Order = orderResult.rows[0];

    // Get order items
    const itemsResult = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
      [id]
    );

    const items: OrderItem[] = itemsResult.rows;

    return {
      ...order,
      items
    };
  } finally {
    client.release();
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  await pool.end();
}
