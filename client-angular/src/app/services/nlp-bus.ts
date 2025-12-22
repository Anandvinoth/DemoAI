//nlp-bus.ts

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { NlpResponse } from '../models/nlp.response';
import { OrderNlpResponse } from '../models/order-nlp.response';
import { ReplaySubject } from 'rxjs';
/**
 * Central bus for all NLP events.
 * Carries both product and order responses, each tagged with a `target`.
 */
export type NlpEvent = (NlpResponse | OrderNlpResponse) & {
  target?: 'orders' | 'products' | 'other';
};

@Injectable({ providedIn: 'root' })
export class NlpBus {
//  private subject = new Subject<NlpEvent>();
  private subject = new ReplaySubject<NlpEvent>(1);
  public events$ = this.subject.asObservable();

  push(res: NlpResponse | OrderNlpResponse, target: 'orders' | 'products' | 'other' = 'other'): void {
//      console.log('%c[NLP Stream] push()', 'color: green; font-weight: bold;', { res, target });
//      console.trace(); // shows the caller
      this.subject.next({ ...res, target });
    }
}

