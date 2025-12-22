// src/app/services/order.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  OrderHistoryResponse
} from '../models/order.model';

/**
 * Request shape for searching / listing orders.
 * This is what we send to the backend.
 */
export interface OrderSearchRequest {
  // free text like "get me all orders", "orders for ACC1002", etc.
  query?: string;

  // explicit filters
  accountId?: string;              // for normal account user
  superUser?: boolean;             // for super user, see all

  // structured faceted filters, e.g. { status: ["Returned"], currency: ["USD"] }
  filters?: Record<string, string[]>;

  // sort string (convention up to your backend)
  // e.g. "order_date desc", "total_amount asc"
  sort?: string;

  // paging
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  // keep base in one place so we can change URL easily later
  private base = 'http://localhost:8000/api/orders';

  constructor(private http: HttpClient) {}

  /**
   * Core method: posts a search request to backend.
   * Backend endpoint name is YOUR choice – adjust if needed.
   * For now: POST /api/orders/history
   */
  searchOrders(body: OrderSearchRequest): Observable<OrderHistoryResponse> {
    return this.http.post<OrderHistoryResponse>(
      `${this.base}/api/orders/history`,
      body
    );
  }

  /**
   * Helper: list orders for a specific account (normal user).
   * Example: accountId = "ACC1002"
   */
  getOrdersForAccount(
    accountId: string,
    page = 1,
    pageSize = 20,
    extra: Partial<OrderSearchRequest> = {}
  ): Observable<OrderHistoryResponse> {
    const body: OrderSearchRequest = {
      accountId,
      superUser: false,
      page,
      pageSize,
      ...extra
    };
    return this.searchOrders(body);
  }

  /**
   * Helper: list ALL orders (for super user).
   */
  getAllOrdersForSuperUser(
    page = 1,
    pageSize = 20,
    extra: Partial<OrderSearchRequest> = {}
  ): Observable<OrderHistoryResponse> {
    const body: OrderSearchRequest = {
      superUser: true,
      page,
      pageSize,
      ...extra
    };
    return this.searchOrders(body);
  }

    /** Core backend call */
  fetchOrders(body: OrderSearchRequest): Observable<OrderHistoryResponse> {
      console.log("Inside fetchOrders method class OrderService########################")
    return this.http.post<OrderHistoryResponse>(`${this.base}/history`, body);
  }
}
