// === Payment Domain ===
export interface PaymentTransaction {
  id: string;
  order_id: string;
  amount_cents: number;
  currency: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  payment_method?: string;
  external_transaction_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Request/Response types
export interface ProcessPaymentRequest {
  order_id: string;
  amount_cents: number;
  currency: string;
  payment_method: string;
}

export interface RefundPaymentRequest {
  payment_id: string;
  amount_cents?: number; // Partial refund if specified
}

// Common API Types
export interface ApiError {
  error: string;
  details?: any;
}

export interface ApiSuccess<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}
