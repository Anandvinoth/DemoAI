// src/app/services/voice/order-tts.service.ts
import { Injectable, NgZone } from '@angular/core';
import { OrderVoiceBus } from './order-voice-bus.service';
import { OrderNlpResponse } from '../../models/order-nlp.response';
import { TtsService } from '../tts.service';
import { VoiceService } from '../voice-service';   // 👈 import the actual mic controller

@Injectable({ providedIn: 'root' })
export class OrderTtsService {
  constructor(
    private bus: OrderVoiceBus,
    private tts: TtsService,
    private mic: VoiceService,   // 👈 use the real mic controller
    private zone: NgZone
  ) {
    console.log('🔊 OrderTtsService initialized');

    this.bus.events$.subscribe((res: OrderNlpResponse) => {
      if (!res) return;

      if (!res.intent?.startsWith('filter_by_') && res.intent !== 'view_all_orders') return;

      let text = res.speech;
      const count = res.numFound ?? res.orders?.length ?? 0;
      if (!text) text = count ? `Showing ${count} orders.` : 'No orders found.';

      console.log('🗣️ OrderTtsService speaking:', text);

      // 🔇 HARD stop mic before TTS
      this.mic.stopListeningDuringTTS();

      this.zone.runOutsideAngular(() => {
        this.tts.speakWhenIdle(text);
      });
    });

    document.addEventListener('tts-started', () => {
      this.mic.stopListeningDuringTTS();
    });

    document.addEventListener('tts-ended', () => {
      this.mic.resumeListeningAfterTTS(600); // resume mic after short delay
    });
  }
}