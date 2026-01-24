import { Component, OnInit } from '@angular/core';
import { Header } from './components/header/header';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { Footer } from './components/footer/footer';
import { VoiceOrderService } from './services/voice/voice-order.service';
import { OrderTtsService } from './services/voice/order-tts.service';
import { VoiceSessionService } from './services/voice/voice-session.service';
import { VoiceTelemetryService } from './services/voice/voice-telemetry.service';
import { VoiceRouteBinderService } from './services/voice/voice-route-binder.service';
import { NlpApiService } from './services/nlp-service';
import { NlpBus } from './services/nlp-bus';
import { createProductsVoiceContext } from './services/voice/contexts/products-voice.context';
import { VoiceContextService } from './services/voice/voice-context.service';
import { createOrdersVoiceContext } from './services/voice/contexts/orders-voice.context';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Header, Footer, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit {
  constructor(
  private voiceOrder: VoiceOrderService,
  private orderTts: OrderTtsService,
  private voiceSession: VoiceSessionService,
  private voiceTelemetry: VoiceTelemetryService,
  private voiceRouteBinder: VoiceRouteBinderService,
  private nlpApi: NlpApiService,
  private bus: NlpBus,
  private router: Router,
  private voiceCtx: VoiceContextService
) {}


  ngOnInit(): void {
      console.log('🎧 Initializing voice services...');
      this.voiceOrder.init();
      const productsCtx = createProductsVoiceContext({
        nlpApi: this.nlpApi,
        bus: this.bus,
        router: this.router,
        telemetry: this.voiceTelemetry,
        voiceSession: this.voiceSession,
        voiceCtx: this.voiceCtx
      });

      const ordersCtx = createOrdersVoiceContext({
        telemetry: this.voiceTelemetry,
        voiceSession: this.voiceSession,
        voiceCtx: this.voiceCtx
      });

      this.voiceSession.register(productsCtx);
      this.voiceSession.register(ordersCtx);

      this.voiceSession.setActive('products');
 }
}
