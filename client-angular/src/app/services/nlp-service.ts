// nlp-service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NlpResponse } from '../models/nlp.response';

export interface ProductSearchRequest {
  query?: string;
  filters?: Record<string, string[]>;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class NlpApiService {
  private base = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  sendUtterance(text: string): Observable<NlpResponse> {
    console.log("################# sendUtterance called in nlp-service ########################");
    return this.http.post<NlpResponse>(`${this.base}/products/voice`, { query: text });
  }

  searchProducts(body: ProductSearchRequest): Observable<NlpResponse> {
    return this.http.post<NlpResponse>(`${this.base}/api/products/query`, body);
  }

  // 🔹 NEW: call FastAPI /api/products/detail
  getProductDetail(productId: string): Observable<NlpResponse> {
    console.log("🔍 getProductDetail →", productId);
    return this.http.post<NlpResponse>(`${this.base}/api/products/detail`, {
      product_id: productId
    });
  }
}

