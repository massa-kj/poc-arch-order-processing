-- Payment tables initialization
-- This script creates the payment tables for the service-based architecture

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL, -- Positive for payments, negative for refunds
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
  payment_method VARCHAR(50),
  external_transaction_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_external_transaction_id ON payments(external_transaction_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_updated_at_trigger
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Insert sample payment data for testing
INSERT INTO payments (
  order_id, amount_cents, currency, status, payment_method, external_transaction_id
) VALUES
-- Sample completed payments
((SELECT id FROM orders LIMIT 1), 2500, 'USD', 'COMPLETED', 'credit_card', 'txn_sample_001'),
((SELECT id FROM orders LIMIT 1), 1500, 'USD', 'COMPLETED', 'paypal', 'txn_sample_002')
ON CONFLICT DO NOTHING;

-- Create a view for payment summaries by order
CREATE OR REPLACE VIEW payment_summaries AS
SELECT
  order_id,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END) as total_paid_cents,
  ABS(SUM(CASE WHEN amount_cents < 0 THEN amount_cents ELSE 0 END)) as total_refunded_cents,
  SUM(amount_cents) as net_amount_cents,
  MAX(created_at) as latest_transaction_at,
  (
    SELECT status
    FROM payments p2
    WHERE p2.order_id = payments.order_id
    ORDER BY created_at DESC
    LIMIT 1
  ) as latest_status
FROM payments
WHERE status IN ('COMPLETED', 'REFUNDED')
GROUP BY order_id;

COMMENT ON TABLE payments IS 'Payment transactions including payments and refunds';
COMMENT ON VIEW payment_summaries IS 'Aggregated payment information per order';

-- Grant necessary permissions (if needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO payment_service_user;
-- GRANT USAGE ON SEQUENCE payments_id_seq TO payment_service_user;
