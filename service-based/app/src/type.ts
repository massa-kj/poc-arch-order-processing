export interface Order {
  id: string;
  userId: string;
  items: { sku: string; qty: number }[];
  status: 'PENDING' | 'CONFIRMED';
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
