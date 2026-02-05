// src/app/services/voice/contexts/products-voice.context.ts

import { VoiceContext } from '../voice-session.service';
import { NlpApiService } from '../../nlp-service';
import { NlpBus } from '../../nlp-bus';
import { VoiceTelemetryService } from '../voice-telemetry.service';
import { Router } from '@angular/router';
import { VoiceSessionService } from '../voice-session.service';
import { VoiceContextService } from '../voice-context.service';

const FACET_KEYS = ['brand', 'color', 'category', 'material', 'price'];

/* ----------------- helpers ----------------- */

function isFacetFilterUtterance(text: string): boolean {
  const u = text.toLowerCase().trim();
  const first = u.split(/\s+/)[0];
  return FACET_KEYS.includes(first);
}

function isOrdersNavigation(text: string): boolean {
  const u = text.toLowerCase().trim();

  return (
    u === 'orders' ||
    u.includes('order') ||              // ← CRITICAL
    u.includes('account') ||
    u.includes('invoice') ||
    /\bacc\s*\d+/.test(u)
  );
}

function isOpportunityNavigation(text: string): boolean {
  const u = text.toLowerCase().trim();
  return (
    u.includes('create opportunity') ||
    u.includes('new opportunity') ||
    u.includes('go to opportunity') ||
    u.includes('opportunity')
  );
}

/* ----------------- context ----------------- */

export function createProductsVoiceContext(deps: {
  nlpApi: NlpApiService;
  bus: NlpBus;
  router: Router;
  telemetry: VoiceTelemetryService;
  voiceSession: VoiceSessionService;
  voiceCtx: VoiceContextService;
}): VoiceContext {

  return {
    id: 'products',
    wantsListening: true,

    /* ---------- ACTIVATE ---------- */
    onActivate() {
      deps.telemetry.emit('CTX_SET_ACTIVE', {
        ctx: 'products',
        message: 'Products voice context activated'
      });

      // ✅ Products OWN continuous mic
      // deps.voiceSession.start({
      //   language: 'en-US',
      //   continuous: true
      // });
    },

    /* ---------- FINAL SPEECH ---------- */
    onFinal(text: string) {
      const u = text.trim();

      /* ---------- HARD NAV: ORDERS ---------- */
      if (isOrdersNavigation(text)) {
          deps.telemetry.emit('STT_ROUTE', {
            ctx: 'products',
            message: 'Routing → orders (handoff)',
            payload: { text }
          });

          // 1️⃣ Switch logical mode (this enables VoiceOrderService)
          deps.voiceCtx.setMode('orders');

          // 2️⃣ Navigate UI
          deps.router.navigate(['/orders']);

          // 3️⃣ IMPORTANT: request a fresh listen for orders
          // (VoiceSession will route FINAL → orders pipeline)
          deps.voiceSession.requestListening({
            language: 'en-US',
            continuous: false
          });

          return;
      }

      /* ---------- HARD NAV: OPPORTUNITY ---------- */
      if (isOpportunityNavigation(u)) {
        deps.telemetry.emit('STT_ROUTE', {
          ctx: 'products',
          message: 'Routing → opportunity create',
          payload: { text: u }
        });

        deps.voiceSession.stop();
        deps.voiceCtx.setMode('opportunity');
        deps.router.navigate(['/crm/opportunities/create']);
        return;                            // ⛔ STOP HERE
      }

      /* ---------- PRODUCTS NLP ---------- */
      deps.telemetry.emit('STT_FINAL', {
        ctx: 'products',
        payload: { text: u }
      });

      /* ---------- FACET FILTER ---------- */
      if (isFacetFilterUtterance(u)) {
        const [keyRaw, ...rest] = u.split(/\s+/);
        const key = keyRaw.toLowerCase();
        const value = rest.join(' ').trim();
        if (!value) return;

        deps.nlpApi.searchProducts({
          query: '*:*',
          filters: { [key]: [value] },
          page: 1,
          pageSize: 20
        }).subscribe(res => {
          deps.bus.push(res, 'products');
          if (!deps.router.url.includes('/store/c')) {
            deps.router.navigate(['/store/c']);
          }
        });

        return;
      }

      /* ---------- DEFAULT PRODUCTS VOICE ---------- */
      deps.nlpApi.sendUtterance(u).subscribe(res => {
        deps.bus.push(res, 'products');
        if (!deps.router.url.includes('/store/c')) {
          deps.router.navigate(['/store/c']);
        }
      });
    }
  };
}
