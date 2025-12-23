// === Inventory Domain ===
export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  available_quantity: number;
  reserved_quantity: number;
  price_cents: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryReservation {
  id: string;
  order_id: string;
  sku: string;
  quantity: number;
  status: "RESERVED" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expires_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityCheck {
  sku: string;
  requested_quantity: number;
  available_quantity: number;
  is_available: boolean;
  price_cents?: number;
}

// Request/Response types
export interface CheckAvailabilityRequest {
  sku: string;
  quantity: number;
}

export interface ReserveInventoryRequest {
  order_id: string;
  items: { sku: string; quantity: number }[];
  expiration_minutes?: number; // Default 30 minutes
}

export interface ReleaseInventoryRequest {
  order_id: string;
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
