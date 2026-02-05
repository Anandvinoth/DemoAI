// src/app/components/header/header.ts
import { Component, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { concatMap, filter, Subscription, tap } from 'rxjs';
import { Router } from '@angular/router';

import { VoiceService } from '../../services/voice-service';
import { NlpApiService } from '../../services/nlp-service';
import { NlpResponse } from '../../models/nlp.response';
import { NlpBus } from '../../services/nlp-bus';
import { VoiceContextService } from '../../services/voice/voice-context.service';
//import { VoiceOpportunityService } from '../../services/voice/voice-opportunity.service';
import { TtsService } from '../../services/tts.service';
import { VoiceSessionService } from '../../services/voice/voice-session.service';
import { VoiceTelemetryService } from '../../services/voice/voice-telemetry.service';
import { createProductsVoiceContext } from '../../services/voice/contexts/products-voice.context';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class Header implements OnDestroy {

  private sub?: Subscription;

  isListening = signal(false);
  lastHeard   = signal('');
  lastResponse = signal<NlpResponse | null>(null);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private readonly openCommands = [
    'open product', 'open this', 'show product',
    'show details', 'view product', 'view item',
    'detail product', 'details'
  ];

  private readonly facetKeys = ['brand', 'color', 'category', 'material', 'price'];

//  ngOnInit(): void {
//      if (!this.router.url.includes('/store')) return;
//
//      const productsCtx = createProductsVoiceContext({
//        nlpApi: this.nlpApi,
//        bus: this.bus,
//        router: this.router,
//        telemetry: this.telemetry,
//        voiceSession: this.voiceSession
//      });
//
//      this.voiceSession.register(productsCtx);
//      this.voiceSession.setActive('products');
//    }


  constructor(
  private voiceCtx: VoiceContextService,
  private voice: VoiceService,
  private nlpApi: NlpApiService,
  private router: Router,
  private voiceSession: VoiceSessionService,
  private telemetry: VoiceTelemetryService,
  //private voiceOpp: VoiceOpportunityService,
  private bus: NlpBus,
  private tts: TtsService
) {
  // 🔊 mic on/off indicator
  this.sub = this.voice.isListening$.subscribe(v =>
    this.isListening.set(v)
  );

  // 🧭 GLOBAL VOICE NAVIGATION (independent of NLP)
  // this.voice.text$.subscribe(text => {
  //   if (!text) return;

  //   console.log('🧭 Global voice heard:', text);

    // const handled = this.handleGlobalNavigation(text);
    // if (handled) {
    //   console.log('🛑 Global navigation handled');
    // }
  // });
}


  // ---------------------------------------------------------
  // 🧠 GLOBAL JOURNEY DETECTOR
  // ---------------------------------------------------------
  private detectJourney(text: string): 'orders' | 'products' | 'opportunity' | 'opp_view' | 'opp_create' | 'other' {
    const u = text.toLowerCase();

    // 👉 Order journey
    if (
      u.includes('order') ||
      u.includes('payment') ||
      u.includes('pending') ||
      u.includes('status') ||
      u.includes('shipment') ||
      u.includes('invoice number') ||
      u.match(/acc\s*\d+/) ||
      u.match(/account\s*\d+/)
    ) return 'orders';

    // 👉 Opportunites by code, e.g., "opp 1001" or "op 1001"
    if (u.match(/\bopp?\s*\d+/)) {
      return 'opportunity';
    }

    // 👉 Product journey
    if (
      u.includes('product') ||
      u.includes('catalog') ||
      u.includes('brand') ||
      u.includes('color') ||
      u.includes('material') ||
      u.includes('item') ||
      u.includes('find') ||
      u.includes('show me')
    ) return 'products';

    // explicit opportunity commands
    if (
      u.includes('start opportunity') ||
      u.includes('stop opportunity')
    ) return 'opportunity';

    if (
      u.includes('go to opportunities view') ||
      u.includes('view opportunities') ||
      u.includes('view opportunity')
    ) return 'opp_view';

    if (
      u.includes('go to opportunities create') ||
      u.includes('create opportunity')
    ) return 'opp_create';

    return 'other';
  }

  private get isProductPage(): boolean {
    return this.router.url.includes('/store/c');
  }

  private get hasProductResults(): boolean {
    return !!this.lastResponse()?.products?.length;
  }
    
  onStart(): void {
      // ✅ only allow Header mic start on products/orders pages (not opportunity pages)
      const active = this.voiceSession.getActiveContextId();
      if (active !== 'products' && active !== 'orders') {
        this.telemetry.emit('ERROR', {
          ctx: active ?? '-',
          message: 'Header mic start blocked (not on products/orders context)'
        });
        return;
      }

      this.telemetry.emit('STT_START', {
        ctx: active ?? 'products',
        message: 'Header mic requested → delegating to context'
      });

       //this.voiceSession.handleMicRequest();
      this.voiceSession.start({ language: 'en-US', continuous: true });
  }


  onStop(): void {
    this.voice.stop();
  }

  onSearchSubmit(): void {
    const val = this.searchInput?.nativeElement.value.trim();
    if (!val) return;
    this.handleManual(val);
  }

  private handleManual(text: string): void {
    const u = text.toLowerCase();

    this.nlpApi.sendUtterance(u).subscribe(res => {
      this.lastResponse.set(res);
      this.bus.push(res, 'products');
      this.router.navigate(['/store/c']);
    });
  }

  ngOnDestroy(): void {
    //this.voiceSession.unregister('products');
    //this.sub?.unsubscribe();
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }
  canUseHeaderMic(): boolean {
      const ctx = this.voiceSession.getActiveContextId();
      return ctx === 'products' || ctx === 'orders';
  }

  private handleGlobalNavigation(text: string): boolean {
      const u = text.toLowerCase().trim();
      
      if (u === 'stop listening' || u === 'mute mic') {
          this.voice.stop();
          //his.voiceSession.forceStop();
          return true;
      }

      // ---- PRODUCTS ----
      if (
        u === 'go to products' ||
        u === 'show products' ||
        u === 'open products'
      ) {
        this.voiceCtx.setMode('products');
        this.router.navigate(['/store/c']);
        //this.voice.stop();
        return true;
      }

      // ---- ORDERS ----
      if (
        u === 'go to orders' ||
        u === 'show orders' ||
        u === 'open orders'
      ) {
        //this.voiceSession.unregister('products');  
        this.voiceCtx.setMode('orders');
        this.router.navigate(['/orders']);
        //this.voice.stop();
        return true;
      }

      // ---- OPPORTUNITY CREATE ----
      if (
        u === 'go to opportunity' ||
        u === 'create opportunity' ||
        u === 'new opportunity'
      ) {
        this.voiceCtx.setMode('opportunity');
        this.router.navigate(['/crm/opportunities/create']);
        this.voice.stop();
        return true;
      }

      // ---- OPPORTUNITY LIST ----
      if (
        u === 'view opportunities' ||
        u === 'show opportunities'
      ) {
        this.voiceCtx.setMode('opportunity');
        this.router.navigate(['/crm/opportunities/list']);
        this.voice.stop();
        //this.voiceSession.forceStop();
        return true;
      }

      return false;
    }
}