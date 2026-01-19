// src/app/pages/order-history/order-history.ts

import { Component, OnInit, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { OrderService, OrderSearchRequest } from '../../services/order.service';
import { Order, FacetBucket, OrderFacets } from '../../models/order.model';
import { OrderVoiceBus } from '../../services/voice/order-voice-bus.service';
import { OrderNlpResponse } from '../../models/order-nlp.response';
import { VoiceContextService } from '../../services/voice/voice-context.service';
import { VoiceService } from '../../services/voice-service';
//import { TtsService } from '../../services/tts.service';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.scss']
})
export class OrderHistory implements OnInit {
  @Input() voiceMode = false;

  // ─── Signals ────────────────────────────────────────────────
  orders = signal<Order[]>([]);
  facets = signal<OrderFacets>({});
  selectedFilters = signal<Record<string, string[]>>({});
  loading = signal(false);
  error = signal<string | null>(null);

  mode = signal<'super' | 'account'>('super');
  activeAccountId = signal<string | null>(null);
  page = signal(1);
  pageSize = signal(20);
  totalPages = signal(1);

   constructor(
      private orderService: OrderService,
      private voiceBus: OrderVoiceBus,
      private voiceCtx: VoiceContextService,
      private voice: VoiceService 
    ) {
      console.log('🔥 OrderHistory CONSTRUCTOR');
      //this.voiceCtx.setMode('orders');
    }


  // ─── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    
    // ✅ Make Orders the owner of voice mode
    this.voiceCtx.setMode('orders');

    // ✅ Allow Header mic + route logs to "orders"
//    this.voiceSession.setActive('orders');

//    this.telemetry.emit('CTX_SET_ACTIVE', {
//     ctx: 'orders',
//     message: 'Orders page activated (mode + active context set)'
//    });  
       
    const isVoice = this.voiceCtx.isVoiceMode();
    console.log('🧭 OrderHistory → voice mode?', isVoice);

    if (!isVoice) {
      console.log('🖱️ Manual mode → loading via /api/orders/history');
      this.fetchOrdersForSuperUser();
    } else {
      console.log('🎤 Voice mode → waiting for NLP results, no API call');
    }
    this.listenToVoiceEvents();
  }

  /** ─── 🎧 Voice Event Listener ─────────────────────────────── */
  private listenToVoiceEvents(): void {
    this.voiceBus.events$
      //.pipe(filter((res: OrderNlpResponse) => res.target === 'orders'))
      .subscribe((res: OrderNlpResponse) => {
        console.log('🎤 Voice→OrderHistory:', res);
        console.log('############################## : ' + res.intent);
        if (
          res.intent === 'order_history' ||
          res.intent === 'view_all_orders' ||
          res.intent === 'filter_orders' ||
          //res.intent === 'filter_by_currency' ||
          res.intent?.startsWith('filter_by_')
        ) {
          console.log('🎙️ NLP triggered OrderHistory:', res);

          // ✅ Direct payload from FastAPI (no extra Solr API call)
          if (res.orders && res.orders.length > 0) {
              this.orders.set(res.orders);
              this.facets.set(res.facets ?? {});
              this.totalPages.set(res.totalPages ?? 1);
              this.loading.set(false);

              if (res.entities?.filters && Object.keys(res.entities.filters).length > 0) {
                this.selectedFilters.set(res.entities.filters);
              }

              // 🔁 FIX: resume mic AFTER TTS completes
              document.addEventListener('tts-ended', () => {
                console.log('🎤 Resuming mic for order follow-ups');

                if (!this.voice.isListening$.value) {
                  this.voice.startListening({
                    language: 'en-US',
                    continuous: true
                  }).subscribe(); // 🔥 IMPORTANT: must subscribe
                }
              }, { once: true });

              return;
           }


          // 🔄 Otherwise interpret entities as navigation or filter intent
          const e = res.entities ?? {};
          if (e.action === 'next_page') return this.nextPage();
          if (e.action === 'prev_page') return this.prevPage();
          if (e.super_user) return this.fetchOrdersForSuperUser();
          if (e.account_id) return this.fetchOrdersForAccount(e.account_id);

          if (e.filters && Object.keys(e.filters).length > 0) {
            console.log('🎯 Applying entity filters:', e.filters);
            this.selectedFilters.set(e.filters);
            this.fetchWithFilters({ filters: e.filters, refreshFacets: true });
            return;
          }

          // fallback
          this.fetchWithFilters({ refreshFacets: true });
        }
      });
  }

  // ─── Fetch Methods ──────────────────────────────────────────
  fetchOrdersForSuperUser(): void {
    this.mode.set('super');
    this.activeAccountId.set(null);
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .fetchOrders({
        superUser: true,
        page: this.page(),
        pageSize: this.pageSize()
      })
      .subscribe({
        next: res => {
          this.orders.set(res.orders ?? []);
          this.facets.set(res.facets ?? {});
          this.totalPages.set(res.totalPages ?? 1);
          this.loading.set(false);
        },
        error: err => {
          console.error('❌ Failed to fetch orders', err);
          this.error.set('Failed to load orders');
          this.loading.set(false);
        }
      });
  }

  fetchOrdersForAccount(accountId: string): void {
    this.mode.set('account');
    this.activeAccountId.set(accountId);
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .fetchOrders({
        accountId: accountId,
        page: this.page(),
        pageSize: this.pageSize()
      })
      .subscribe({
        next: res => {
          this.orders.set(res.orders ?? []);
          this.facets.set(res.facets ?? {});
          this.totalPages.set(res.totalPages ?? 1);
          this.loading.set(false);
        },
        error: err => {
          console.error('❌ Failed to fetch orders', err);
          this.error.set('Failed to load orders');
          this.loading.set(false);
        }
      });
  }

  fetchWithFilters(params?: {
    filters?: Record<string, string[]>;
    page?: number;
    append?: boolean;
    refreshFacets?: boolean;
  }) {
    const body: OrderSearchRequest = {
      query: '*:*',
      filters: params?.filters ?? this.selectedFilters(),
      page: params?.page ?? this.page(),
      pageSize: this.pageSize()
    };

    if (this.mode() === 'super') body.superUser = true;
    else if (this.mode() === 'account' && this.activeAccountId())
      body.accountId = this.activeAccountId() ?? undefined;

    this.loading.set(true);
    this.error.set(null);

    this.orderService.fetchOrders(body).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        this.orders.set(params?.append ? [...this.orders(), ...res.orders] : res.orders);

        if (params?.refreshFacets !== false && res.facets) {
          this.facets.set(res.facets ?? {});
        }

        this.totalPages.set(res.totalPages ?? 1);
      },
      error: err => {
        this.loading.set(false);
        this.error.set('Error fetching orders.');
        console.error('❌ Order fetch failed:', err);
      }
    });
  }

  // ─── Facet Logic ────────────────────────────────────────────
  toggleFacet(facetKey: string, bucket: FacetBucket): void {
    const current = { ...this.selectedFilters() };
    const selectedList = current[facetKey] ? [...current[facetKey]] : [];
    const idx = selectedList.indexOf(bucket.name);
    if (idx >= 0) selectedList.splice(idx, 1);
    else selectedList.push(bucket.name);
    if (selectedList.length > 0) current[facetKey] = selectedList;
    else delete current[facetKey];
    this.selectedFilters.set(current);
    this.fetchWithFilters();
  }

  clearAllFilters(): void {
    this.selectedFilters.set({});
    this.fetchWithFilters();
  }

  isSelected(facetKey: keyof OrderFacets, value: string): boolean {
    return this.selectedFilters()[facetKey]?.includes(value) ?? false;
  }

  // ─── Row & Pagination ──────────────────────────────────────
  toggleExpand(order: Order): void {
    order.expanded = !order.expanded;
  }

  trackByOrderId(index: number, order: Order): string | number {
    return order.order_id;
  }

  hasSelectedFilters(): boolean {
    return Object.keys(this.selectedFilters()).length > 0;
  }

  get facetsArray(): { key: keyof OrderFacets; value: FacetBucket[] }[] {
    return Object.entries(this.facets()).map(([key, value]) => ({
      key: key as keyof OrderFacets,
      value: value ?? []
    }));
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(v => v + 1);
      this.fetchWithFilters({
        page: this.page(),
        filters: this.selectedFilters(),
        append: false,
        refreshFacets: false
      });
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(v => v - 1);
      this.fetchWithFilters({
        page: this.page(),
        filters: this.selectedFilters(),
        append: false,
        refreshFacets: false
      });
    }
  }
}
