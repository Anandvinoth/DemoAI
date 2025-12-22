// src/app/services/voice/order-nlp.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OrderNlpResponse } from '../../models/order-nlp.response';

@Injectable({ providedIn: 'root' })
export class OrderNlpService {
  private base = 'http://localhost:8000'; // or your K8S API endpoint

  constructor(private http: HttpClient) {}

  /**
   * Send user utterance text to FastAPI → returns NLP-parsed intent + entities
   * Expected payload from FastAPI:
   * {
   *   "intent": "order_history",
   *   "entities": {
   *     "super_user": true,
   *     "filters": {},
   *     "account_id": "ACC1002"
   *   }
   * }
   */
  analyzeUtterance(text: string): Observable<OrderNlpResponse> {
    console.log("#############!!!!!!!!!????????$$$$$$$$$ : " + text);
    const body = { query: text };
    console.log('🧠 Sending NLP request:', body);

    return this.http.post<OrderNlpResponse>(
      `${this.base}/api/orders/voice`,
      body
    );
  }
}
