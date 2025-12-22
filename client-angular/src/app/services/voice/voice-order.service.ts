// src/app/services/voice/voice-order.service.ts
import { Injectable } from '@angular/core';
import { debounceTime, filter, switchMap } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { VoiceService } from '../voice-service';
import { OrderNlpService } from './order-nlp.service';
import { OrderVoiceBus } from './order-voice-bus.service';
import { VoiceContextService } from './voice-context.service';

@Injectable({ providedIn: 'root' })
export class VoiceOrderService {
  private sub?: Subscription;

  constructor(
    private voice: VoiceService,
    private nlp: OrderNlpService,
    private bus: OrderVoiceBus,
    private voiceCtx: VoiceContextService
  ) {}

  init() {
    console.log("init method called in VoiceOrderService!! ");

    this.sub = this.voice.text$
      .pipe(
        debounceTime(300),

        // ------------------------------
        // 🟦 1) ONLY RUN IN ORDER MODE
        // ------------------------------
        filter(() => {
          const active = this.voiceCtx.isOrders();
            console.log("🟨 Order service inactive (mode != orders)" + active);
          if (!active) {
            console.log("🟨 Order service inactive (mode != orders)" + active);
          }
          return active;
        }),

        filter(t => !!t.trim()),

        filter(text => {
          const u = text.toLowerCase();
          console.log("voiceOrderService - user text is :", u);
            
          // IGNORE ONLY the initial navigation "go to orders"
          if (u === 'go to orders' || u === 'orders' || u === 'show orders') {
                console.log("🛑 Skipping handover utterance:", u);
                return false;
          }

          // ------------------------------
          // 🟥 IGNORE product-related text
          // ------------------------------
          if (
            u.includes('product') ||
            u.includes('catalog') ||
            u.includes('brand') ||
            u.includes('color') ||
            u.includes('material') ||
            u.includes('category')  
          ) {
            console.log('🛑 VoiceOrderService ignored product query:', u);
            return false;
          }

          return true;
        }),

        // ------------------------------
        // NLP call → /api/orders/voice
        // ------------------------------
        switchMap(text => this.nlp.analyzeUtterance(text))
      )
      .subscribe({
        next: res => {
          console.log('📢 VoiceOrderService emit:', res);
          this.bus.emit(res);
        },
        error: err => console.error('VoiceOrderService error:', err)
      });
  }

  stop() {
    this.sub?.unsubscribe();
  }
}
