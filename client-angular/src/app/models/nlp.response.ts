// models/nlp-response.ts
export interface NlpResponse {
  input: string;
  intent: string;
  entities: string[];
  solr_query: string;

  products?: any[];     // Solr products array (list page)
  product?: any;        // 🔹 Single product (detail response)
  product_id?: string;  // 🔹 Optional product id for detail

  facets?: any;

  numFound?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;

  /** Target tells Angular which page should handle this response */
  target?: 'orders' | 'products' | 'other';

  // union compatibility with order responses
  orders?: any[];
  speech?: string;

  /** Optional Angular-only fields (ok to keep if you already added them) */
  action?: string;
  index?: number;
}

