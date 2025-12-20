export interface Order {
  id: string;
  user_id: string;
  status: "PENDING" | "CONFIRMED";
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

export interface ApiError {
  error: string;
}
