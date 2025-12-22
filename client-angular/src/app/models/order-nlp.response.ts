//src/app/models/order-nlp.response.ts

export interface OrderNlpResponse {
  intent: 'order_history' | 'view_all_orders' | 'unknown' | 'filter_orders';
  entities: {
    account_id?: string;
    super_user?: boolean;
    filters?: Record<string, string[]>;
    sort?: string;
    page?: number;
    action?: 'next_page' | 'prev_page';
  };
  orders?: any[];
  facets?: Record<string, any>;
  numFound?: number;
  totalPages?: number;
  page?: number;
  speech?: string;
  pageSize?: number;
  target?: 'orders' | 'products' | 'other';
  // ✅ Optional additions to align with product model
  input?: string;
  solr_query?: string;
  products?: any[];
}

