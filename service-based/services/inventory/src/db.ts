import { Pool } from 'pg';
import {
  InventoryItem,
  InventoryReservation,
  AvailabilityCheck,
  ReserveInventoryRequest,
  ReleaseInventoryRequest
} from './types.js';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('Inventory Service: Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Inventory Service: Unexpected error on idle client', err);
  process.exit(-1);
});

export async function checkAvailability(sku: string, requestedQuantity: number): Promise<AvailabilityCheck> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT sku, available_quantity, price_cents FROM inventory WHERE sku = $1',
      [sku]
    );

    if (result.rows.length === 0) {
      return {
        sku,
        requested_quantity: requestedQuantity,
        available_quantity: 0,
        is_available: false
      };
    }

    const item = result.rows[0];
    const isAvailable = item.available_quantity >= requestedQuantity;

    return {
      sku,
      requested_quantity: requestedQuantity,
      available_quantity: item.available_quantity,
      is_available: isAvailable,
      price_cents: item.price_cents
    };
  } finally {
    client.release();
  }
}

export async function getInventoryItem(sku: string): Promise<InventoryItem | null> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT * FROM inventory WHERE sku = $1',
      [sku]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

export async function reserveInventory(request: ReserveInventoryRequest): Promise<InventoryReservation[]> {
  const client = await pool.connect();
  const expirationMinutes = request.expiration_minutes || 30;
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  try {
    await client.query('BEGIN');

    const reservations: InventoryReservation[] = [];

    // Check availability and create reservations for all items
    for (const item of request.items) {
      // Check current availability
      const availabilityResult = await client.query(
        'SELECT available_quantity, reserved_quantity FROM inventory WHERE sku = $1',
        [item.sku]
      );

      if (availabilityResult.rows.length === 0) {
        throw new Error(`Item with SKU ${item.sku} not found`);
      }

      const currentItem = availabilityResult.rows[0];
      if (currentItem.available_quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.sku}. Available: ${currentItem.available_quantity}, Requested: ${item.quantity}`);
      }

      // Update inventory quantities (reduce available, increase reserved)
      await client.query(
        'UPDATE inventory SET available_quantity = available_quantity - $1, reserved_quantity = reserved_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE sku = $2',
        [item.quantity, item.sku]
      );

      // Create reservation record
      const reservationResult = await client.query(
        'INSERT INTO inventory_reservations (order_id, sku, quantity, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [request.order_id, item.sku, item.quantity, expiresAt]
      );

      reservations.push(reservationResult.rows[0]);
    }

    await client.query('COMMIT');
    return reservations;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmReservation(orderId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update reservation status to CONFIRMED
    await client.query(
      'UPDATE inventory_reservations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND status = $3',
      ['CONFIRMED', orderId, 'RESERVED']
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseReservation(request: ReleaseInventoryRequest): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get all reservations for this order
    const reservationsResult = await client.query(
      'SELECT sku, quantity FROM inventory_reservations WHERE order_id = $1 AND status IN ($2, $3)',
      [request.order_id, 'RESERVED', 'CONFIRMED']
    );

    // Release reserved quantities back to available
    for (const reservation of reservationsResult.rows) {
      await client.query(
        'UPDATE inventory SET available_quantity = available_quantity + $1, reserved_quantity = reserved_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE sku = $2',
        [reservation.quantity, reservation.sku]
      );
    }

    // Mark reservations as released
    await client.query(
      'UPDATE inventory_reservations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND status IN ($3, $4)',
      ['RELEASED', request.order_id, 'RESERVED', 'CONFIRMED']
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT * FROM inventory ORDER BY name'
    );

    return result.rows;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
