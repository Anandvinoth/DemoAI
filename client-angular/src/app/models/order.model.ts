// src/app/models/order.model.ts

/** Represents a single product within an order's items list */
export interface OrderItem {
  item_id: string;
  product_id: string;
  product_detail_id?: string;
  product_name: string;
  brand: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/** Represents a product detail record */
export interface ProductDetail {
  product_id: string;
  name: string;
  brand: string;
  price: number;
  material?: string;
  color?: string;
  weight?: string;
  image_url?: string;
}

/** Represents an individual order document */
export interface Order {
  order_id: string;
  account_id: string;
  order_date: string;
  status: string;
  warehouse_status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  discount_applied?: number;
  tax_amount?: number;
  shipping_fee?: number;
  expected_delivery?: string;
  actual_delivery?: string;
  notes?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;

  total_items?: number;
  total_quantity?: number;
  avg_unit_price?: number;
  total_value?: number;

  // nested lists
  items?: OrderItem[];
  product_details?: ProductDetail[];

  // for UI helpers
  expanded?: boolean; // helps toggle expanded view in the UI
}

/** Represents a single facet bucket like status, currency, etc. */
export interface FacetBucket {
  name: string;
  count: number;
}

/** Represents all facets returned by Solr */
export interface OrderFacets {
  account_id?: FacetBucket[];
  status?: FacetBucket[];
  payment_status?: FacetBucket[];
  warehouse_status?: FacetBucket[];
  currency?: FacetBucket[];
}

/** Full Solr response for order history */
export interface OrderHistoryResponse {
  numFound: number;
  orders: Order[];
  facets?: OrderFacets;
  page: number;
  pageSize: number;
  totalPages: number;
}
