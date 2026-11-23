export type Role = "admin" | "manager" | "support";
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active?: boolean;
  created_at?: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface Adjustment {
  id: number;
  delta: number;
  reason: string;
  created_at: string;
  user_name: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  order_count?: number;
  lifetime_value?: number;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  total: number;
  created_at: string;
  customer_id: number;
  customer_name: string;
  item_count: number;
}

export interface OrderDetail extends OrderSummary {
  notes: string | null;
  customer_email: string;
  items: { id: number; product_id: number; sku: string; name: string; quantity: number; unit_price: number; line_total: number }[];
  events: { id: number; from_status: OrderStatus | null; to_status: OrderStatus; note: string | null; created_at: string; user_name: string | null }[];
  next_statuses: OrderStatus[];
}

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Stats {
  orders: number;
  revenue: number;
  avg_order_value: number;
  open_orders: number;
  by_status: Partial<Record<OrderStatus, number>>;
  daily: { day: string; revenue: number; orders: number }[];
  top_products: { id: number; name: string; units: number }[];
  low_stock_products: number;
}
