export interface Order {
  id: string;
  user_id: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  id?: string;
  order_id: string;
  sku: string;
  quantity: number;
  created_at?: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// Request/Response types
export interface CreateOrderRequest {
  userId: string;
  items: { sku: string; qty: number }[];
}

export interface OrderParams {
  id: string;
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
