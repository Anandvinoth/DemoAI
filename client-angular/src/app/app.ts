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
  private router: Router
) {}


  ngOnInit(): void {
  console.log('🎧 Initializing voice services...');

  // 🔑 REGISTER PRODUCTS CONTEXT (ONCE)
  this.voiceSession.register(
    createProductsVoiceContext({
      nlpApi: this.nlpApi,
      bus: this.bus,
      router: this.router,
      telemetry: this.voiceTelemetry,
      voiceSession: this.voiceSession
    })
  );

  // existing init
  this.voiceOrder.init();
}

}
