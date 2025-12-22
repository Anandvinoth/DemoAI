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
import { VoiceOpportunityService } from '../../services/voice/voice-opportunity.service';
import { TtsService } from '../../services/tts.service';

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

  constructor(
    private voiceCtx: VoiceContextService,
    private voice: VoiceService,
    private nlpApi: NlpApiService,
    private router: Router,
    private voiceOpp: VoiceOpportunityService,
    private bus: NlpBus,
    private tts: TtsService
  ) {
    this.sub = this.voice.isListening$.subscribe(v => this.isListening.set(v));
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

  // ---------------------------------------------------------
  // 🎙️ Start Listening
  // ---------------------------------------------------------
  onStart(): void {
    // 🔥 Ensure TTS is not speaking when we start listening
    this.tts.stop();

    this.sub?.unsubscribe();

    this.sub = this.voice.startListening({ language: 'en-US', continuous: true })
      .pipe(
        filter(t => !!t.trim()),
        tap(t => this.lastHeard.set(t)),

        tap(utter => {
          console.log('user said : ' + utter);

          // 🔒 HARD LOCK: Opportunity guided mode owns all utterances (blocks product/orders/NLP)
//          if (this.voiceOpp.inGuidedMode()) {
//            console.log('🔐 Opportunity Guided Mode ACTIVE — blocking all other flows');
//            this.voiceCtx.setMode('opportunity');
//            this.voiceOpp.process(utter);
//            throw new Error('__abort_pipeline__');
//          }

          const journey = this.detectJourney(utter);
          console.log('🌎 GLOBAL Journey detected:', journey);

          if (journey === 'opp_view') {
            console.log('📄 Navigating → Opportunities View');
            this.voiceCtx.setMode('opportunity');
            this.router.navigate(['/crm/opportunities/list']);
            this.voice.stop();
            throw new Error('__abort_pipeline__');
          }

          if (journey === 'opp_create') {
            console.log('📝 Navigating → Opportunities Create');
            this.voiceCtx.setMode('opportunity');
            this.router.navigate(['/crm/opportunities/create']);
            this.voice.stop();
            throw new Error('__abort_pipeline__');
          }
            
          // 🔥 FIRST TIME entering opportunity flow
          if (journey === 'opportunity' && this.voiceCtx.mode() !== 'opportunity') {
              console.log('🌟 Entering Opportunity Journey');
              this.voiceCtx.setMode('opportunity');
              this.voiceOpp.startGuidedFlow();
              throw new Error('__abort_pipeline__');
           }
          
          // 🔥 HARD MODAL OWNERSHIP — NOTHING ELSE MAY RUN
          if (this.voiceCtx.mode() === 'opportunity') {
              this.voiceOpp.process(utter);

              console.log('🛑 Pipeline aborted intentionally (opportunity override)');
              throw new Error('__abort_pipeline__'); // ⛔ ABSOLUTE STOP — do not fall through
          }
            
          // 🔥 FIRST TIME entering opportunity flow
//          if (journey === 'opportunity') {
//            console.log('🌟 Entering Opportunity Journey');
//            this.voiceCtx.setMode('opportunity');
//            this.voiceOpp.startGuidedFlow();
//            throw new Error('__abort_pipeline__');
//          }

//          if (this.voiceCtx.mode() === 'opportunity') {
//              this.voiceOpp.process(utter);
//
//              // 🔥 HARD STOP: opportunity owns ALL input
//              throw new Error('__abort_pipeline__');
//          }


          // ---------------------------------------------------
          // ORDER MODE  ✅ DO NOT ABORT PIPELINE ✅ DO NOT STOP MIC
          // ---------------------------------------------------
          if (journey === 'orders') {
            console.log('🌎 GLOBAL → ORDERS Journey');
            this.voiceCtx.setMode('orders');
            this.voice.muteToApi(); // block product NLP
            if (!this.router.url.includes('/orders')) {
              this.router.navigate(['/orders']);
            }
            // ✅ Let orders pipeline continue (do not throw)
            return;
          }

          // ---------------------------------------------------
          // PRODUCT MODE
          // ---------------------------------------------------
          if (journey === 'products') {
            console.log('🌎 GLOBAL → PRODUCTS Journey');

            this.voiceCtx.setMode('products');
            this.voice.unmuteToApi();

            // ✅ Reset product state when (re)entering product journey
            this.bus.push({
              target: 'products',
              intent: '__reset__',
              input: '',
              entities: [],
              solr_query: '',
              products: [],
              facets: {},
              page: 1,
              pageSize: 20
            });

            if (!this.isProductPage) {
              this.router.navigate(['/store/c']);
            }

            // allow pipeline to continue for product NLP
            return;
          }

          // OTHER → allow fallthrough
        }), 

        // ------------------------------  
        // product-only filters  
        // ------------------------------
        filter(() => {
          if (this.voice.mutedToApi$.value) {
            console.log('🛑 Product NLP muted due to Order flow');
            return false;
          }
          return true;
        }),

        // ----------------------------
        // OPEN PRODUCT
        // ----------------------------
        filter(text => {
          const normalized = text.trim().toLowerCase();
          console.log(' ############ Open Product Logic called in header.ts ############ ' + normalized);

          if (this.openCommands.some(cmd => normalized.includes(cmd))) {
            const last = this.lastResponse();
            console.log('PRINTING LAST ########## ------> ' + (this.lastResponse()?.products?.length ?? 0));
            if (!last?.products?.length) return false;

            const first = last.products[0];
            const productId = (first as any).id || (first as any).product_id;

            this.nlpApi.getProductDetail(productId).subscribe(detail => {
              const payload: NlpResponse = { ...(detail as any), target: 'products' } as any;
              this.lastResponse.set(payload);
              this.bus.push(payload, 'products');
              if (!this.isProductPage) this.router.navigate(['/store/c']);
            });

            return false;
          }
          return true;
        }),

        // ----------------------------
        // FACET → searchProducts ONLY
        // ----------------------------
        filter(text => {
          const u = text.toLowerCase().trim();
          const words = u.split(' ');
          const first = words[0];
          console.log('searchProducts to be called for facet filetering : ' + this.isProductPage);

          if (this.isProductPage && this.hasProductResults && this.facetKeys.includes(first)) {
            const value = words.slice(1).join(' ').trim();
            if (!value) return false;

            const filters: any = {};
            filters[first] = [value];

            this.nlpApi.searchProducts({
              query: this.lastResponse()?.solr_query ?? '*:*',
              filters,
              page: 1,
              pageSize: 20
            }).subscribe(res => {
              this.lastResponse.set(res);
              this.bus.push(res, 'products');
            });

            return false;
          }

          return true;
        }),

        // ----------------------------
        // Default → NLP
        // ----------------------------
        concatMap((text: string) => {
          console.log('🎤 NLP (PRODUCT) →', text);
          return this.nlpApi.sendUtterance(text);
        })
      )
      .subscribe({
        next: (res: NlpResponse) => {
          this.lastResponse.set(res);
          this.bus.push(res, 'products');

          const intent = res.intent?.toLowerCase() ?? '';
          if (
            intent.startsWith('product_') ||
            intent.startsWith('search_') ||
            intent === 'filter_products'
          ) {
            if (!this.isProductPage) this.router.navigate(['/store/c']);
          }
        },
        error: (err: any) => {
          if (err?.message === '__abort_pipeline__') {
            console.log('🛑 Pipeline aborted intentionally (opportunity/order override)');
            return;
          }

          if (err?.type === 'orders') {
            console.log('📦 Forwarding utterance to Orders NLP:', err.utter);
            return;
          }

          console.error(err);
        }
      });
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
    this.sub?.unsubscribe();
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }
}