import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';
import { AvatarComponent } from './/avatar/avatar.component';

import { VoiceOrderService } from './services/voice/voice-order.service';
import { OrderTtsService } from './services/voice/order-tts.service';
import { VoiceSessionService } from './services/voice/voice-session.service';
import { VoiceTelemetryService } from './services/voice/voice-telemetry.service';
import { VoiceRouteBinderService } from './services/voice/voice-route-binder.service';

import { NlpApiService } from './services/nlp-service';
import { NlpBus } from './services/nlp-bus';

import { createProductsVoiceContext } from './services/voice/contexts/products-voice.context';
import { createOrdersVoiceContext } from './services/voice/contexts/orders-voice.context';
import { VoiceContextService } from './services/voice/voice-context.service';
import { TtsService } from './services/tts.service';
import { DemoDriveService } from './services/voice/demo-drive.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Header, Footer, RouterOutlet, AvatarComponent],
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
    private voiceCtx: VoiceContextService,
    private demoDrive: DemoDriveService,
    private tts: TtsService
  ) {}

  ngOnInit(): void {

    console.log('🎧 Initializing DEMO mode (waiting for user interaction)');

    // 1️⃣ Always land on assistant page (avatar screen)
    if (this.router.url !== '/assistant') {
      this.router.navigateByUrl('/assistant', { replaceUrl: true });
    }

    // 2️⃣ Init backend-dependent services (safe to do immediately)
    this.voiceOrder.init();

    // 3️⃣ Register ONLY real business contexts
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

    // 4️⃣ HARD STOP mic — demo is deterministic
    this.voiceSession.stop();

    // 5️⃣ START DEMO ONLY AFTER FIRST USER INTERACTION
    // const startDemoOnce = () => {
    //   console.log('🖱️ User interaction detected — starting demo');

    //   this.tts.unlock();          // 🔓 unlock browser audio
    //   this.demoDrive.start();     // 🚗 START DEMO (ONLY HERE)

    //   window.removeEventListener('click', startDemoOnce);
    //   window.removeEventListener('keydown', startDemoOnce);
    // };

    // window.addEventListener('click', startDemoOnce);
    // window.addEventListener('keydown', startDemoOnce);
  }
}
