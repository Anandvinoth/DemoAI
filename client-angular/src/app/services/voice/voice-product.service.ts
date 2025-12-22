// src/app/services/voice/voice-product.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NlpResponse } from '../../models/nlp.response';
import { TtsService } from '../tts.service';
import { VoiceContextService } from './voice-context.service';
import { NlpBus } from '../nlp-bus';

@Injectable({ providedIn: 'root' })
export class VoiceProductService {
  private base = 'http://localhost:8000';

  constructor(
    private http: HttpClient,
    private tts: TtsService,
    private voiceCtx: VoiceContextService,
    private bus: NlpBus
  ) {}

  send(text: string) {
    const body = { query: text };
    console.log('🧠 [Product] Sending NLP request:', body);

    this.http.post<NlpResponse>(`${this.base}/products/voice`, body)
      .subscribe({
        next: (res: NlpResponse) => {
          console.log('📢 [Product] VoiceBus emit:', res);

          this.voiceCtx.enable();
          this.bus.push(res);

          // 🔥 DETECT FILTER COMMANDS (Brand, Color, Category, Material, Price)
          if (res.intent?.startsWith('search_by_') || res.intent === 'facet_filter') {

            const filters: any = {};
            res.entities.forEach(e => {
              const [k, v] = e.split(':');
              if (v) filters[k] = v;
            });

            console.log('🎯 [Product] Detected filters →', filters);

            this.http.post<any>(`${this.base}/api/products/query`, {
              query: "",
              filters,
              page: 1,
              pageSize: 20
            }).subscribe(filtered => {

              const wrapped: NlpResponse = {
                input: text,
                intent: res.intent,
                entities: res.entities,
                solr_query: "*:*",

                numFound: filtered.numFound,
                products: filtered.products,
                facets: filtered.facets,
                page: filtered.page,
                pageSize: filtered.pageSize,
                totalPages: filtered.totalPages,

                speech: `Showing ${filtered.numFound} products filtered by ${Object.keys(filters).join(", ")}.`
              };

              console.log("✨ [Product] Sending filtered NLP:", wrapped);
              this.bus.push(wrapped);

              if (wrapped.speech) {
                this.tts.speakWhenIdle(wrapped.speech);
              }

              this.voiceCtx.disable();
            });

            return;
          }

          // Normal TTS
          if (res.speech) {
            this.tts.speakWhenIdle(res.speech);
          }

          this.voiceCtx.disable();
        },

        error: err => {
          console.error('❌ [Product] NLP failed:', err);
          this.voiceCtx.disable();
        }
      });
  }
}
