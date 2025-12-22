import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  OpportunityMetadata,
  OpportunityCreateRequest
} from '../models/opportunity.model';

@Injectable({ providedIn: 'root' })
export class OpportunityService {
  private base = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  getMetadata(): Observable<OpportunityMetadata> {
    return this.http.get<OpportunityMetadata>(
      `${this.base}/api/opportunities/metadata`
    );
  }

  createOpportunity(payload: OpportunityCreateRequest): Observable<any> {
    // NOTE: Your URL has /api/api/... – keeping it exactly as you gave it
    return this.http.post(
      `${this.base}/api/api/opportunities/create`,
      payload
    );
  }
    
  listOpportunities() {
    return this.http.get<any>('http://localhost:8000/api/api/opportunities/list');
  }
}
