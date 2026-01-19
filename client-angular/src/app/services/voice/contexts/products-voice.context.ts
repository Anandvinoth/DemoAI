// src/app/services/voice/contexts/products-voice.context.ts
import { VoiceContext } from '../voice-session.service';
import { NlpApiService } from '../../nlp-service';
import { NlpBus } from '../../nlp-bus';
import { VoiceTelemetryService } from '../voice-telemetry.service';
import { Router } from '@angular/router';
import { VoiceSessionService } from '../voice-session.service';

const FACET_KEYS = ['brand', 'color', 'category', 'material', 'price'];

export function createProductsVoiceContext(deps: {
  nlpApi: NlpApiService;
  bus: NlpBus;
  router: Router;
  telemetry: VoiceTelemetryService;
  voiceSession: VoiceSessionService;
}): VoiceContext {
  return {
    id: 'products',
    wantsListening: true,

    // ------------------------------------------------
    // ACTIVATE
    // ------------------------------------------------
    onActivate() {
      deps.telemetry.emit('CTX_SET_ACTIVE', {
        ctx: 'products',
        message: 'Products voice context activated'
      });

      // 🔥 Products owns continuous mic
      deps.voiceSession.start({
        language: 'en-US',
        continuous: true
      });
    },

    // ------------------------------------------------
    // FINAL SPEECH
    // ------------------------------------------------
    onFinal(text: string) {
      const normalized = text.toLowerCase().trim();
      const firstWord = normalized.split(' ')[0];

      deps.telemetry.emit('STT_FINAL', {
        ctx: 'products',
        payload: { text }
      });

      // --------------------------------------------
      // NAVIGATION COMMANDS
      // --------------------------------------------
      if (
        normalized.includes('create opportunity') ||
        normalized.includes('new opportunity')
      ) {
        deps.router.navigate(['/crm/opportunities/create']);
        return;
      }

      // --------------------------------------------
      // FACET FILTER → /api/products/query
      // --------------------------------------------
      // --------------------------------------------
      if (FACET_KEYS.includes(firstWord)) {
          const value = normalized.split(' ').slice(1).join(' ').trim();
          if (!value) return;

          deps.telemetry.emit('STT_ROUTE', {
            ctx: 'products',
            message: 'Routing facet filter → /api/products/query',
            payload: { facet: firstWord, value }
          });

          deps.nlpApi.searchProducts({
            query: '*:*',
            filters: {
              [firstWord]: [value]
            },
            page: 1,
            pageSize: 20
          }).subscribe(res => {
            deps.bus.push(res, 'products');

            if (!deps.router.url.includes('/store/c')) {
              deps.router.navigate(['/store/c']);
            }

            // 🔁 re-arm mic AFTER ProductList TTS
            document.addEventListener('tts-ended', function rearm() {
              document.removeEventListener('tts-ended', rearm);
              deps.voiceSession.requestListening({
                language: 'en-US',
                continuous: true
              });
            });
          });

       return; // 🔒 IMPORTANT: stop here
      }


      // --------------------------------------------
      // GENERAL PRODUCT QUERY → /products/voice
      // --------------------------------------------
      deps.telemetry.emit('STT_ROUTE', {
        ctx: 'products',
        message: 'Routing NLP → /products/voice',
        payload: { text }
      });

      deps.nlpApi.sendUtterance(text).subscribe(res => {
        deps.bus.push(res, 'products');

        if (!deps.router.url.includes('/store/c')) {
          deps.router.navigate(['/store/c']);
        }

        // 🔁 re-arm mic AFTER TTS
        document.addEventListener('tts-ended', function rearm() {
          document.removeEventListener('tts-ended', rearm);
          deps.voiceSession.requestListening({
            language: 'en-US',
            continuous: true
          });
        });
      });
    }
  };
}
