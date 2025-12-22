// src/app/services/voice/order-voice-bus.service.ts
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { OrderNlpResponse } from '../../models/order-nlp.response';

@Injectable({ providedIn: 'root' })
export class OrderVoiceBus {
  private subject = new Subject<OrderNlpResponse>();

  /** Observable stream for components to listen on */
  get events$(): Observable<OrderNlpResponse> {
    return this.subject.asObservable();
  }

  /** Emit a new NLP result event */
  emit(event: OrderNlpResponse): void {
    console.log('📢 VoiceBus emit:', event);
    this.subject.next(event);
  }
}
